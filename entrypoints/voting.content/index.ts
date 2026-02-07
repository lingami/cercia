// Content script to enable interactive voting on Moltbook posts and comments.

import { upvotePost, downvotePost, upvoteComment, downvoteComment } from "../../src/api/client";
import {
  getVote,
  setVote,
  removeVote,
  getVotesForIds,
  type VoteType,
} from "../../src/storage/votes";
import {
  installInterceptor,
  lookupCommentId as interceptorLookupCommentId,
  clearInterceptedData,
} from "../../src/api/interceptor";
import {
  fetchCommentLookupMap,
  lookupCommentId as cacheLookupCommentId,
  clearCommentLookupCache,
} from "../../src/api/comment-lookup";
import { onNavigate } from "../../src/navigation";

const AUTH_STORAGE_KEY = "cercia_auth";

// Colors for vote states.
const COLORS = {
  upvoteActive: "#e01b24", // Red when upvoted.
  downvoteActive: "#7193ff", // Blue when downvoted.
  neutralGray: "#888888", // Gray for neutral state (used in combined format sidebar).
};

// Track initialized elements to avoid duplicates on re-initialization.
const initializedPostIds = new Set<string>();

// Track current URL for SPA navigation detection.
let lastUrl = "";

interface VoteElements {
  postId: string;
  container: HTMLElement;
  upvoteArrow: HTMLElement;
  voteCount: HTMLElement;
  downvoteArrow: HTMLElement;
}

interface CommentVoteElements {
  commentId: string;
  container: HTMLElement;
  upvoteArrow: HTMLElement;
  voteCount: HTMLElement;
  downvoteArrow: HTMLElement;
}

async function getApiKey(): Promise<string | null> {
  const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
  const data = stored[AUTH_STORAGE_KEY] as { apiKey?: string } | undefined;
  return data?.apiKey || null;
}

function extractPostId(href: string): string | null {
  const match = href.match(/\/post\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

function getPostIdFromUrl(): string | null {
  return extractPostId(window.location.pathname);
}

function isPostDetailPage(): boolean {
  return getPostIdFromUrl() !== null;
}

function updateVoteUI(elements: VoteElements, voteState: VoteType | null, voteCount?: number) {
  const { upvoteArrow, downvoteArrow, voteCount: voteCountEl } = elements;

  // Check if this is a combined format (arrow and count in same element).
  const isCombined = upvoteArrow === voteCountEl && upvoteArrow.dataset.cerciaCombined === "true";
  const arrowChar = upvoteArrow.dataset.cerciaArrow || "▲";

  // Update colors based on vote state.
  // For combined format (sidebar), use data attribute for CSS to handle colors.
  // This persists better through React re-renders than inline styles.
  if (isCombined) {
    if (voteState === "up") {
      upvoteArrow.dataset.cerciaVote = "up";
    } else if (voteState === "down") {
      upvoteArrow.dataset.cerciaVote = "down";
    } else {
      delete upvoteArrow.dataset.cerciaVote;
    }
  } else {
    // For separate format (main feed), use inline styles.
    if (voteState === "up") {
      upvoteArrow.style.color = COLORS.upvoteActive;
      if (downvoteArrow && downvoteArrow !== upvoteArrow) {
        downvoteArrow.style.color = "";
      }
      voteCountEl.style.color = COLORS.upvoteActive;
    } else if (voteState === "down") {
      upvoteArrow.style.color = "";
      if (downvoteArrow && downvoteArrow !== upvoteArrow) {
        downvoteArrow.style.color = COLORS.downvoteActive;
      }
      voteCountEl.style.color = COLORS.downvoteActive;
    } else {
      upvoteArrow.style.color = "";
      voteCountEl.style.color = "";
      if (downvoteArrow && downvoteArrow !== upvoteArrow) {
        downvoteArrow.style.color = "";
      }
    }
  }

  // Update vote count if provided.
  if (voteCount !== undefined) {
    if (isCombined) {
      // For combined format, update the whole text with arrow + count.
      voteCountEl.textContent = `${arrowChar} ${voteCount}`;
    } else {
      voteCountEl.textContent = String(voteCount);
    }
  }
}

function findVoteElements(postLink: HTMLAnchorElement): VoteElements | null {
  const href = postLink.getAttribute("href");
  if (!href) return null;

  const postId = extractPostId(href);
  if (!postId) return null;

  // Skip if already processed by Cercia.
  if (postLink.dataset.cerciaProcessed) return null;

  // Search anywhere in the post link for upvote arrow (▲ or ⬆).
  let upvoteArrow: HTMLElement | null = null;
  let downvoteArrow: HTMLElement | null = null;
  let voteCountEl: HTMLElement | null = null;
  let voteContainer: HTMLElement | null = null;

  // Find all spans and look for vote patterns.
  const allSpans = postLink.querySelectorAll("span");
  for (const span of allSpans) {
    const text = span.textContent?.trim();
    if (text === "▲" || text === "⬆") {
      upvoteArrow = span as HTMLElement;
      voteContainer = span.parentElement as HTMLElement;
    } else if (text === "▼" || text === "⬇") {
      downvoteArrow = span as HTMLElement;
    } else if (text && /^-?\d+$/.test(text) && !voteCountEl) {
      // Number in a span - likely vote count.
      if (upvoteArrow) {
        voteCountEl = span as HTMLElement;
      }
    }
  }

  // If no upvote found, check for combined format like "▲ 2379" in a single span.
  // For combined formats, we use the same span for both arrow and count to avoid
  // React re-rendering destroying our modifications.
  if (!upvoteArrow) {
    for (const span of allSpans) {
      const text = span.textContent?.trim() || "";
      const combinedMatch = text.match(/^([▲⬆])\s*(-?\d+)$/);
      if (combinedMatch) {
        // Use the combined span as both upvote arrow and vote count.
        // We'll handle this specially in click handlers and UI updates.
        upvoteArrow = span as HTMLElement;
        voteCountEl = span as HTMLElement;
        voteContainer = span.parentElement as HTMLElement;

        // Mark as combined format for special handling.
        (span as HTMLElement).dataset.cerciaCombined = "true";
        (span as HTMLElement).dataset.cerciaArrow = combinedMatch[1];
        // Note: CSS handles the gray default color for sidebar. JS sets data-cercia-vote for upvoted.
        break;
      }
    }
  }

  if (!upvoteArrow) return null;

  // If no vote count found in spans, look for text nodes in the container.
  if (!voteCountEl && voteContainer) {
    // Check child nodes (including text nodes) for numbers.
    for (const node of voteContainer.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text && /^-?\d+$/.test(text)) {
          // Wrap the text node in a span for easier manipulation.
          voteCountEl = document.createElement("span");
          voteCountEl.textContent = text;
          node.replaceWith(voteCountEl);
          break;
        }
      }
    }
  }

  // If still no vote count, look for siblings of upvote that contain numbers.
  if (!voteCountEl && voteContainer) {
    for (const child of voteContainer.children) {
      if (child === upvoteArrow || child === downvoteArrow) continue;
      const text = child.textContent?.trim();
      if (text && /^-?\d+$/.test(text)) {
        voteCountEl = child as HTMLElement;
        break;
      }
    }
  }

  // If still no vote count, create a placeholder.
  if (!voteCountEl && voteContainer) {
    voteCountEl = document.createElement("span");
    voteCountEl.textContent = "0";
    upvoteArrow.after(voteCountEl);
  }

  if (!voteCountEl || !voteContainer) return null;

  // Check if this is a combined format (arrow and count in same element).
  const isCombined = upvoteArrow.dataset.cerciaCombined === "true";

  // If no downvote arrow exists, create one for consistency (but not for combined format).
  if (!downvoteArrow && !isCombined) {
    downvoteArrow = document.createElement("span");
    downvoteArrow.textContent = "▼";
    downvoteArrow.style.opacity = "0.5";
    voteCountEl.after(downvoteArrow);
  }

  // For combined format without a real downvote, use a placeholder to avoid null issues.
  if (!downvoteArrow) {
    downvoteArrow = upvoteArrow; // Use same element as placeholder.
  }

  // Mark as processed.
  postLink.dataset.cerciaProcessed = "true";

  return {
    postId,
    container: voteContainer,
    upvoteArrow,
    voteCount: voteCountEl,
    downvoteArrow,
  };
}

// Find vote elements on a post detail page where buttons are used instead of spans.
function findPostDetailVoteElements(): VoteElements | null {
  const postId = getPostIdFromUrl();
  if (!postId) return null;

  // On post detail pages, vote buttons are actual <button> elements.
  // Find buttons containing ▲ and ▼ characters.
  const allButtons = Array.from(document.querySelectorAll("button"));
  const upvoteButton = allButtons.find((b) => b.textContent?.trim() === "▲");
  const downvoteButton = allButtons.find((b) => b.textContent?.trim() === "▼");

  if (!upvoteButton || !downvoteButton) {
    console.log("[Cercia] Could not find vote buttons on post detail page");
    return null;
  }

  // Find the vote count - it should be between the buttons or nearby.
  // Look for a sibling or nearby element with a number.
  const container = upvoteButton.parentElement;
  if (!container) return null;

  // Find the vote count element - likely a span with just a number between the buttons.
  let voteCountEl: HTMLElement | null = null;
  const children = container.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement;
    // Skip the buttons themselves.
    if (child === upvoteButton || child === downvoteButton) continue;
    // Check if this looks like a vote count (contains just a number).
    const text = child.textContent?.trim();
    if (text && /^-?\d+$/.test(text)) {
      voteCountEl = child;
      break;
    }
  }

  if (!voteCountEl) {
    // Create a placeholder if no count element found.
    console.log("[Cercia] Could not find vote count element, creating placeholder");
    voteCountEl = document.createElement("span");
    voteCountEl.textContent = "0";
    container.insertBefore(voteCountEl, downvoteButton);
  }

  return {
    postId,
    container,
    upvoteArrow: upvoteButton,
    voteCount: voteCountEl,
    downvoteArrow: downvoteButton,
  };
}

// Calculate the vote count change based on previous and new vote states.
function calculateCountChange(previousVote: VoteType | null, newVote: VoteType | null): number {
  // Vote impact: up = +1, down = -1, null = 0
  const previousImpact = previousVote === "up" ? 1 : previousVote === "down" ? -1 : 0;
  const newImpact = newVote === "up" ? 1 : newVote === "down" ? -1 : 0;
  return newImpact - previousImpact;
}

async function handleVoteClick(
  elements: VoteElements,
  clickedVote: VoteType,
  apiKey: string,
): Promise<void> {
  const { postId, upvoteArrow, downvoteArrow, voteCount } = elements;

  // Get current vote state from local storage.
  const currentVote = await getVote("post", postId);

  // Determine new vote state - toggle off if clicking same vote.
  const isToggleOff = currentVote === clickedVote;
  const newVote: VoteType | null = isToggleOff ? null : clickedVote;

  // Get current displayed count.
  // For combined format (▲ 123), extract just the number part.
  const isCombined = voteCount.dataset.cerciaCombined === "true";
  let currentCount: number;
  if (isCombined) {
    const match = voteCount.textContent?.match(/-?\d+/);
    currentCount = match ? parseInt(match[0], 10) : 0;
  } else {
    currentCount = parseInt(voteCount.textContent || "0", 10);
  }

  // Calculate the expected new count based on vote state change.
  const countChange = calculateCountChange(currentVote, newVote);
  const expectedCount = currentCount + countChange;

  // Show loading state.
  upvoteArrow.style.opacity = "0.5";
  downvoteArrow.style.opacity = "0.5";

  // Make API call - use the clicked vote direction (API will toggle if already voted).
  const result =
    clickedVote === "up" ? await upvotePost(apiKey, postId) : await downvotePost(apiKey, postId);

  // Reset opacity.
  upvoteArrow.style.opacity = "1";
  downvoteArrow.style.opacity = "1";

  if (result.success && result.data) {
    // Update local storage based on new vote state.
    if (newVote === null) {
      await removeVote("post", postId);
    } else {
      await setVote("post", postId, newVote);
    }

    // Update UI with locally calculated count (don't trust API count).
    updateVoteUI(elements, newVote, expectedCount);

    const action = isToggleOff ? "removed" : "recorded";
    console.log(
      `[Cercia] Vote ${action}: ${newVote || "none"} on post ${postId}`,
      result.data.message || "",
    );
  } else {
    // Revert to previous state on error.
    updateVoteUI(elements, currentVote, currentCount);

    // Check for specific error messages.
    if (result.error?.includes("already")) {
      // User already voted this way - this might mean we're out of sync.
      // If toggling off failed with "already", the API might not support unvoting.
      // In that case, keep the vote as-is in local storage.
      if (!isToggleOff) {
        await setVote("post", postId, clickedVote);
        updateVoteUI(elements, clickedVote);
      }
      console.log(`[Cercia] Vote state synced: ${clickedVote}`);
    } else {
      console.error(`[Cercia] Vote failed:`, result.error);
    }
  }
}

function styleVoteElements(elements: VoteElements): void {
  const { upvoteArrow, downvoteArrow } = elements;

  // Collect unique elements to style (avoid duplicates for combined format).
  const elementsToStyle = new Set([upvoteArrow, downvoteArrow]);

  // Style arrows to look clickable.
  elementsToStyle.forEach((arrow) => {
    arrow.style.cursor = "pointer";
    arrow.style.transition = "transform 0.1s, opacity 0.2s";
    arrow.style.userSelect = "none";

    // Hover effect.
    arrow.addEventListener("mouseenter", () => {
      arrow.style.transform = "scale(1.2)";
    });
    arrow.addEventListener("mouseleave", () => {
      arrow.style.transform = "scale(1)";
    });
  });
}

// Global flag to track if the document-level vote click handler is set up.
let documentVoteHandlerAttached = false;

// Store for API key to use in delegated handlers.
let globalApiKey: string | null = null;

function setupDocumentVoteHandler(apiKey: string | null): void {
  if (documentVoteHandlerAttached) return;
  documentVoteHandlerAttached = true;
  globalApiKey = apiKey;

  // Use document-level event delegation to handle post vote clicks.
  // This avoids issues with React re-rendering and replacing elements.
  // Only handles POST votes (feed, sidebar, detail page). Comment votes
  // are handled by their own individual click handlers and must not be
  // intercepted here.
  document.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;

      // Check if the click was on a vote button/element.
      const text = target.textContent?.trim() || "";
      let clickedOnVote = false;
      let voteType: "up" | "down" = "up";

      if (text.match(/^[▲⬆]\s*\d*$/) || text === "▲" || text === "⬆") {
        clickedOnVote = true;
        voteType = "up";
      } else if (text === "▼" || text === "⬇") {
        clickedOnVote = true;
        voteType = "down";
      }

      if (!clickedOnVote) return;

      // Determine if this is a POST vote vs a COMMENT vote.
      // Post votes are either: inside a post link (feed/sidebar) or a
      // standalone button on a post detail page. Comment votes are span
      // elements inside comment containers, not inside post links.
      let postId: string | null = null;
      let voteElements: VoteElements | null = null;

      const postLink = target.closest('a[href*="/post/"]') as HTMLAnchorElement;
      if (postLink) {
        // Click inside a post link (feed page or sidebar).
        postId = extractPostId(postLink.getAttribute("href") || "");
        if (postId) {
          voteElements = findVoteElementsById(postLink, postId);
        }
      } else if (target.tagName === "BUTTON") {
        // Click on standalone vote button (post detail page).
        postId = getPostIdFromUrl();
        if (postId) {
          voteElements = findPostDetailVoteElements();
        }
      } else {
        // Not a post vote (likely a comment vote). Let the event propagate
        // so the comment's own click handler can process it.
        return;
      }

      // At this point we know it's a post vote. Prevent navigation.
      e.preventDefault();
      e.stopPropagation();

      if (!globalApiKey) {
        console.log("[Cercia] Vote click ignored - not logged in");
        return;
      }

      if (!postId || !voteElements) {
        console.log("[Cercia] Could not determine post ID or find vote elements");
        return;
      }

      await handleVoteClick(voteElements, voteType, globalApiKey);
    },
    true,
  ); // true = capturing phase

  console.log("[Cercia] Document-level vote handler attached");
}

function attachVoteHandlers(
  _elements: VoteElements,
  apiKey: string | null,
  _postLink?: HTMLAnchorElement,
): void {
  // Just ensure the document-level handler is set up.
  // Individual element handlers are no longer needed due to React re-rendering issues.
  setupDocumentVoteHandler(apiKey);
}

// Helper to find vote elements by post ID (for re-finding after React re-renders).
function findVoteElementsById(postLink: HTMLAnchorElement, postId: string): VoteElements | null {
  let upvoteArrow: HTMLElement | null = null;
  let downvoteArrow: HTMLElement | null = null;
  let voteCountEl: HTMLElement | null = null;
  let voteContainer: HTMLElement | null = null;

  const allSpans = postLink.querySelectorAll("span");

  // First, look for separate arrow spans.
  for (const span of allSpans) {
    const text = span.textContent?.trim();
    if (text === "▲" || text === "⬆") {
      upvoteArrow = span as HTMLElement;
      voteContainer = span.parentElement as HTMLElement;
    } else if (text === "▼" || text === "⬇") {
      downvoteArrow = span as HTMLElement;
    } else if (text && /^-?\d+$/.test(text) && !voteCountEl && upvoteArrow) {
      voteCountEl = span as HTMLElement;
    }
  }

  // Check for combined format if no separate arrow found.
  if (!upvoteArrow) {
    for (const span of allSpans) {
      const text = span.textContent?.trim() || "";
      if (text.match(/^[▲⬆]\s*-?\d+$/)) {
        upvoteArrow = span as HTMLElement;
        voteCountEl = span as HTMLElement;
        voteContainer = span.parentElement as HTMLElement;
        upvoteArrow.dataset.cerciaCombined = "true";
        upvoteArrow.dataset.cerciaArrow = text[0];
        break;
      }
    }
  }

  if (!upvoteArrow || !voteCountEl || !voteContainer) return null;

  // Use upvoteArrow as downvote placeholder for combined format.
  if (!downvoteArrow) {
    downvoteArrow = upvoteArrow;
  }

  return {
    postId,
    container: voteContainer,
    upvoteArrow,
    voteCount: voteCountEl,
    downvoteArrow,
  };
}

function makeVotesInteractive(postLink: HTMLAnchorElement, apiKey: string): VoteElements | null {
  const elements = findVoteElements(postLink);
  if (!elements) return null;

  // Skip if already initialized.
  if (initializedPostIds.has(elements.postId)) return null;
  initializedPostIds.add(elements.postId);

  styleVoteElements(elements);
  attachVoteHandlers(elements, apiKey, postLink);

  return elements;
}

function makePostDetailVotesInteractive(apiKey: string): VoteElements | null {
  const elements = findPostDetailVoteElements();
  if (!elements) return null;

  // Skip if already initialized.
  if (initializedPostIds.has(elements.postId)) return null;
  initializedPostIds.add(elements.postId);

  styleVoteElements(elements);
  attachVoteHandlers(elements, apiKey);

  return elements;
}

// ============================================================================
// Comment Voting Functions
// ============================================================================

// Look up a comment ID - first try intercepted data, then fall back to shared cache.
function lookupCommentId(
  postId: string,
  authorName: string,
  contentSnippet: string,
): string | null {
  // First, try the interceptor's lookup (populated from live API responses).
  const interceptedId = interceptorLookupCommentId(authorName, contentSnippet);
  if (interceptedId) {
    return interceptedId;
  }

  // Fall back to the shared comment lookup cache.
  return cacheLookupCommentId(postId, authorName, contentSnippet);
}

// Simplified comment vote elements - ID is resolved on-demand.
interface PendingCommentVoteElements {
  container: HTMLElement;
  upvoteArrow: HTMLElement;
  voteCount: HTMLElement;
  downvoteArrow: HTMLElement;
  authorName: string;
  contentSnippet: string;
  resolvedCommentId: string | null;
}

// Find all comment vote elements in the DOM and prepare them for voting.
function findAndPrepareCommentVoteElements(): PendingCommentVoteElements[] {
  const results: PendingCommentVoteElements[] = [];

  // Find all spans with the vote pattern (▲ number ▼).
  const spans = document.querySelectorAll("span.flex.items-center.gap-1");

  spans.forEach((span) => {
    // Skip if already processed by Cercia.
    if ((span as HTMLElement).dataset.cerciaProcessed) return;

    const children = Array.from(span.children);
    const hasUpArrow = children.some((c) => c.textContent?.trim() === "▲");
    const hasDownArrow = children.some((c) => c.textContent?.trim() === "▼");

    if (!hasUpArrow || !hasDownArrow) return;

    // Go up to find the comment container (py-2 class).
    const commentRoot = span.closest(".py-2");
    if (!commentRoot) return;

    // Check if this is actually a comment (not the main post).
    const userLink = commentRoot.querySelector('a[href^="/u/"]');
    if (!userLink) return;

    const authorName = userLink.textContent?.trim().replace(/^u\//, "") || "";

    // Get content from the prose div.
    const proseDiv = commentRoot.querySelector(".prose");
    const contentSnippet = proseDiv?.textContent?.trim().slice(0, 100) || "";

    // Extract vote elements from the span.
    const childNodes = Array.from((span as HTMLElement).childNodes);
    let upvoteArrow: HTMLElement | null = null;
    let downvoteArrow: HTMLElement | null = null;
    let voteCountNode: Text | null = null;
    let existingVoteCountSpan: HTMLElement | null = null;

    for (const child of childNodes) {
      if (child instanceof HTMLElement) {
        if (child.textContent?.trim() === "▲") {
          upvoteArrow = child;
        } else if (child.textContent?.trim() === "▼") {
          downvoteArrow = child;
        } else if (/^-?\d+$/.test(child.textContent?.trim() || "")) {
          // This might be our previously created vote count span.
          existingVoteCountSpan = child;
        }
      } else if (child instanceof Text) {
        const text = child.textContent?.trim();
        if (text && /^-?\d+$/.test(text)) {
          voteCountNode = child;
        }
      }
    }

    if (!upvoteArrow || !downvoteArrow) return;

    // Get or create the vote count element.
    let voteCountEl: HTMLElement;
    if (existingVoteCountSpan) {
      // Reuse existing span (from previous initialization or site's own span).
      voteCountEl = existingVoteCountSpan;
    } else if (voteCountNode) {
      // Wrap vote count text node in a span for easier manipulation.
      voteCountEl = document.createElement("span");
      voteCountEl.textContent = voteCountNode.textContent;
      voteCountNode.replaceWith(voteCountEl);
    } else {
      // Create a placeholder if no count found.
      voteCountEl = document.createElement("span");
      voteCountEl.textContent = "0";
      (span as HTMLElement).insertBefore(voteCountEl, downvoteArrow);
    }

    // Mark as processed.
    (span as HTMLElement).dataset.cerciaProcessed = "true";

    results.push({
      container: span as HTMLElement,
      upvoteArrow,
      voteCount: voteCountEl,
      downvoteArrow,
      authorName,
      contentSnippet,
      resolvedCommentId: null,
    });
  });

  return results;
}

// Update comment vote UI (same logic as post votes).
function updateCommentVoteUI(
  elements: CommentVoteElements,
  voteState: VoteType | null,
  voteCount?: number,
) {
  const { upvoteArrow, downvoteArrow, voteCount: voteCountEl } = elements;

  if (voteState === "up") {
    upvoteArrow.style.color = COLORS.upvoteActive;
    downvoteArrow.style.color = "";
    voteCountEl.style.color = COLORS.upvoteActive;
  } else if (voteState === "down") {
    upvoteArrow.style.color = "";
    downvoteArrow.style.color = COLORS.downvoteActive;
    voteCountEl.style.color = COLORS.downvoteActive;
  } else {
    upvoteArrow.style.color = "";
    downvoteArrow.style.color = "";
    voteCountEl.style.color = "";
  }

  if (voteCount !== undefined) {
    voteCountEl.textContent = String(voteCount);
  }
}

// Handle comment vote click - resolves comment ID on-demand if needed.
async function handlePendingCommentVoteClick(
  elements: PendingCommentVoteElements,
  clickedVote: VoteType,
  apiKey: string,
  postId: string,
): Promise<void> {
  const { upvoteArrow, downvoteArrow, voteCount, authorName, contentSnippet } = elements;

  // Skip if we already know this comment is unfindable.
  if (elements.resolvedCommentId === "UNFINDABLE") {
    return;
  }

  // Resolve comment ID if not already resolved (should be instant from cache).
  if (!elements.resolvedCommentId) {
    const commentId = lookupCommentId(postId, authorName, contentSnippet);
    if (!commentId) {
      console.warn(`[Cercia] Could not find comment ID for ${authorName}'s comment in lookup map.`);
      // Mark as unfindable.
      elements.resolvedCommentId = "UNFINDABLE";
      upvoteArrow.title = "Unable to vote - comment not found in API results";
      upvoteArrow.style.cursor = "not-allowed";
      upvoteArrow.style.opacity = "0.5";
      return;
    }
    elements.resolvedCommentId = commentId;
  }

  const commentId = elements.resolvedCommentId;

  // Show loading state.
  upvoteArrow.style.opacity = "0.5";
  downvoteArrow.style.opacity = "0.5";
  const currentVote = await getVote("comment", commentId);
  const isToggleOff = currentVote === clickedVote;
  const newVote: VoteType | null = isToggleOff ? null : clickedVote;

  const currentCount = parseInt(voteCount.textContent || "0", 10);
  const countChange = calculateCountChange(currentVote, newVote);
  const expectedCount = currentCount + countChange;

  // Make API call.
  const result =
    clickedVote === "up"
      ? await upvoteComment(apiKey, commentId)
      : await downvoteComment(apiKey, commentId);

  // Reset opacity.
  upvoteArrow.style.opacity = "1";
  downvoteArrow.style.opacity = "1";

  // Create elements object for UI update.
  const uiElements: CommentVoteElements = {
    commentId,
    container: elements.container,
    upvoteArrow,
    voteCount,
    downvoteArrow,
  };

  if (result.success && result.data) {
    if (newVote === null) {
      await removeVote("comment", commentId);
    } else {
      await setVote("comment", commentId, newVote);
    }

    updateCommentVoteUI(uiElements, newVote, expectedCount);

    const action = isToggleOff ? "removed" : "recorded";
    console.log(`[Cercia] Comment vote ${action}: ${newVote || "none"} on comment ${commentId}`);
  } else {
    // Revert to previous state on error.
    updateCommentVoteUI(uiElements, currentVote, currentCount);

    if (result.error?.includes("already")) {
      if (!isToggleOff) {
        await setVote("comment", commentId, clickedVote);
        updateCommentVoteUI(uiElements, clickedVote);
      }
      console.log(`[Cercia] Comment vote state synced: ${clickedVote}`);
    } else {
      console.error(`[Cercia] Comment vote failed:`, result.error);
    }
  }
}

// Style comment vote elements.
function stylePendingCommentVoteElements(elements: PendingCommentVoteElements): void {
  const { upvoteArrow, downvoteArrow } = elements;

  [upvoteArrow, downvoteArrow].forEach((arrow) => {
    arrow.style.cursor = "pointer";
    arrow.style.transition = "transform 0.1s, opacity 0.2s";
    arrow.style.userSelect = "none";

    arrow.addEventListener("mouseenter", () => {
      arrow.style.transform = "scale(1.2)";
    });
    arrow.addEventListener("mouseleave", () => {
      arrow.style.transform = "scale(1)";
    });
  });
}

// Attach vote handlers to pending comment elements.
// Note: Moltbook API only supports upvoting comments (405 on downvote), so we disable downvotes.
function attachPendingCommentVoteHandlers(
  elements: PendingCommentVoteElements,
  apiKey: string,
  postId: string,
): void {
  const { upvoteArrow, downvoteArrow } = elements;

  upvoteArrow.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handlePendingCommentVoteClick(elements, "up", apiKey, postId);
  });

  // Disable downvote for comments - API doesn't support it (returns 405).
  downvoteArrow.style.opacity = "0.3";
  downvoteArrow.style.cursor = "not-allowed";
  downvoteArrow.title = "Comment downvoting not supported by Moltbook";
  downvoteArrow.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[Cercia] Comment downvoting is not supported by the Moltbook API");
  });
}

// Initialize comment voting on a post detail page.
// Fetches comment data upfront to enable instant ID lookups.
async function initializeCommentVoting(apiKey: string): Promise<number> {
  const postId = getPostIdFromUrl();
  if (!postId) return 0;

  console.log("[Cercia] Initializing comment voting...");

  // Find and prepare comment vote elements in DOM.
  const commentElements = findAndPrepareCommentVoteElements();
  console.log(`[Cercia] Found ${commentElements.length} comment vote elements in DOM`);

  if (commentElements.length === 0) {
    return 0;
  }

  // Fetch comment data upfront to build the lookup map.
  // This makes ID lookups instant when users click to vote.
  await fetchCommentLookupMap(postId);

  // Resolve comment IDs upfront and collect them for cache lookup.
  const resolvedCommentIds: string[] = [];
  for (const elements of commentElements) {
    const commentId = lookupCommentId(postId, elements.authorName, elements.contentSnippet);
    if (commentId) {
      elements.resolvedCommentId = commentId;
      resolvedCommentIds.push(commentId);
    } else {
      elements.resolvedCommentId = "UNFINDABLE";
    }
  }

  // Load cached vote states for resolved comments.
  const cachedVotes = await getVotesForIds("comment", resolvedCommentIds);

  // Style and attach handlers for all comments, applying cached vote states.
  for (const elements of commentElements) {
    stylePendingCommentVoteElements(elements);
    attachPendingCommentVoteHandlers(elements, apiKey, postId);

    // Apply cached vote state if available.
    if (elements.resolvedCommentId && elements.resolvedCommentId !== "UNFINDABLE") {
      const cachedVote = cachedVotes.get(elements.resolvedCommentId);
      if (cachedVote) {
        const uiElements: CommentVoteElements = {
          commentId: elements.resolvedCommentId,
          container: elements.container,
          upvoteArrow: elements.upvoteArrow,
          voteCount: elements.voteCount,
          downvoteArrow: elements.downvoteArrow,
        };
        updateCommentVoteUI(uiElements, cachedVote);
      }
    }
  }

  console.log(
    `[Cercia] Comment voting prepared for ${commentElements.length} comments ` +
      `(${resolvedCommentIds.length} IDs resolved, ${cachedVotes.size} cached votes applied)`,
  );

  return commentElements.length;
}

async function initializeVoting() {
  // Check if user is logged in.
  const apiKey = await getApiKey();

  // Always set up the document-level click handler to prevent navigation on vote clicks.
  // This ensures clicking votes doesn't navigate away, even if not logged in.
  setupDocumentVoteHandler(apiKey);

  if (!apiKey) {
    console.log("[Cercia] Voting disabled - not logged in (click handler still active)");
    return;
  }

  console.log("[Cercia] Initializing voting...");

  const allElements: VoteElements[] = [];
  let commentCount = 0;

  // Check if we're on a post detail page.
  if (isPostDetailPage()) {
    console.log("[Cercia] Detected post detail page");
    const elements = makePostDetailVotesInteractive(apiKey);
    if (elements) {
      allElements.push(elements);
    }

    // Initialize comment voting on post detail pages.
    commentCount = await initializeCommentVoting(apiKey);
  }

  // Also find all post links (for feed pages or embedded posts on detail pages).
  const postLinks = document.querySelectorAll('a[href^="/post/"]') as NodeListOf<HTMLAnchorElement>;

  // Make votes interactive and collect elements.
  postLinks.forEach((postLink) => {
    const elements = makeVotesInteractive(postLink, apiKey);
    if (elements) {
      allElements.push(elements);
    }
  });

  if (allElements.length === 0 && commentCount === 0) {
    console.log("[Cercia] No posts or comments found to enable voting");
    return;
  }

  // Load cached vote states for posts.
  if (allElements.length > 0) {
    const postIds = allElements.map((e) => e.postId);
    const cachedVotes = await getVotesForIds("post", postIds);

    // Apply cached vote states to UI.
    allElements.forEach((elements) => {
      const cachedVote = cachedVotes.get(elements.postId);
      if (cachedVote) {
        updateVoteUI(elements, cachedVote);
      }
    });
  }

  console.log(
    `[Cercia] Voting enabled for ${allElements.length} posts and ${commentCount} comments`,
  );
}

// Re-apply cached vote state to a post link (for re-rendered elements).
async function reapplyVoteState(postLink: HTMLAnchorElement): Promise<void> {
  const href = postLink.getAttribute("href");
  if (!href) return;

  const postId = extractPostId(href);
  if (!postId) return;

  // Check if this post link is in a sidebar (combined format).
  const isInSidebar =
    postLink.closest("aside") !== null || postLink.closest('[role="complementary"]') !== null;
  if (!isInSidebar) return;

  // Find vote elements fresh from DOM.
  const elements = findVoteElementsById(postLink, postId);
  if (!elements) return;

  // Apply cached vote state if exists.
  const cachedVote = await getVote("post", postId);
  if (cachedVote) {
    updateVoteUI(elements, cachedVote);
  }
}

// Periodically refresh sidebar vote states to handle React re-renders.
// This is necessary because React can replace DOM elements after our initial processing.
async function refreshSidebarVoteStates(): Promise<void> {
  const sidebar =
    document.querySelector("aside") || document.querySelector('[role="complementary"]');
  if (!sidebar) return;

  const postLinks = sidebar.querySelectorAll('a[href*="/post/"]') as NodeListOf<HTMLAnchorElement>;

  for (const postLink of postLinks) {
    const href = postLink.getAttribute("href");
    if (!href) continue;

    const postId = extractPostId(href);
    if (!postId) continue;

    // Find the vote span element.
    const voteSpan = postLink.querySelector('span[class*="text-[#ff4500]"]') as HTMLElement | null;
    if (!voteSpan) continue;

    // Check if we need to apply cached vote state.
    // Only apply if the element has cerciaCombined but no cerciaVote data attribute.
    const cachedVote = await getVote("post", postId);
    if (cachedVote && !voteSpan.dataset.cerciaVote) {
      // Mark as combined format if not already.
      if (!voteSpan.dataset.cerciaCombined) {
        const text = voteSpan.textContent?.trim() || "";
        const match = text.match(/^([▲⬆])/);
        if (match) {
          voteSpan.dataset.cerciaCombined = "true";
          voteSpan.dataset.cerciaArrow = match[1];
        }
      }

      // Apply the cached vote state.
      voteSpan.dataset.cerciaVote = cachedVote;
    }
  }
}

// Start periodic sidebar refresh.
function startSidebarRefresh(): void {
  // Initial refresh after a short delay.
  setTimeout(refreshSidebarVoteStates, 1000);

  // Then refresh every 2 seconds to catch React re-renders.
  setInterval(refreshSidebarVoteStates, 2000);
}

// Watch for new posts being added (infinite scroll, etc.) and re-rendered sidebar posts.
function observeNewPosts(apiKey: string) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const newPostLinks = node.querySelectorAll(
            'a[href^="/post/"]',
          ) as NodeListOf<HTMLAnchorElement>;
          newPostLinks.forEach(async (postLink) => {
            const elements = makeVotesInteractive(postLink, apiKey);
            if (elements) {
              // New post - apply cached vote state.
              const cachedVote = await getVote("post", elements.postId);
              if (cachedVote) {
                updateVoteUI(elements, cachedVote);
              }
            } else {
              // Already initialized post that was re-rendered - re-apply vote state.
              await reapplyVoteState(postLink);
            }
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Re-initialize voting when navigating to a new page.
async function handleNavigation() {
  console.log(`[Cercia] Navigation detected: ${lastUrl} -> ${window.location.href}`);
  lastUrl = window.location.href;

  // Clear state for fresh initialization.
  initializedPostIds.clear();
  clearCommentLookupCache();
  clearInterceptedData();

  // Wait for the page content to render.
  await new Promise((resolve) => setTimeout(resolve, 500));

  await initializeVoting();
}

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",

  main() {
    console.log("[Cercia] Voting content script loaded");

    // Install the API interceptor to capture post/comment data from responses.
    installInterceptor();

    // Listen for SPA navigation events via the Navigation API.
    onNavigate((url) => {
      if (url !== lastUrl) {
        handleNavigation();
      }
    });

    // Initialize voting after a brief delay for page to render.
    setTimeout(async () => {
      lastUrl = window.location.href;
      await initializeVoting();

      // Watch for new posts (infinite scroll).
      const apiKey = await getApiKey();
      if (apiKey) {
        observeNewPosts(apiKey);

        // Start periodic sidebar refresh to handle React re-renders.
        startSidebarRefresh();
      }
    }, 500);
  },
});
