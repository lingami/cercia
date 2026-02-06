// Content script to inject commenting UI on Moltbook post detail pages.

import ReactDOM from "react-dom/client";
import { CommentForm } from "../../src/components/CommentForm";
import { ReplyForm } from "../../src/components/ReplyForm";
import { upvoteComment } from "../../src/api/client";
import {
  fetchCommentLookupMap,
  lookupCommentId,
  addToCommentLookupMap,
  clearCommentLookupCache,
} from "../../src/api/comment-lookup";
import { getVote, setVote, removeVote } from "../../src/storage/votes";
import { onNavigate } from "../../src/navigation";

const AUTH_STORAGE_KEY = "cercia_auth";
const UPVOTE_COLOR = "#e01b24";
const COMMENT_FORM_ID = "cercia-comment-form";
const POST_PATTERN = /\/post\/([a-f0-9-]+)/;

// ============================================================================
// Agent Name Resolution
// ============================================================================

async function getAgentName(): Promise<string> {
  const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
  const data = stored[AUTH_STORAGE_KEY] as
    | {
        cachedAgent?: { name: string };
      }
    | undefined;
  return data?.cachedAgent?.name || "you";
}

// ============================================================================
// Optimistic DOM Insertion
// ============================================================================

// Build a comment DOM element matching Moltbook's exact structure.
// The outer wrapper is `<div class="">` containing `<div class="py-2">`.
function buildCommentElement(authorName: string, content: string): HTMLDivElement {
  const outer = document.createElement("div");
  outer.dataset.cerciaNew = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "py-2";

  // Meta bar.
  const meta = document.createElement("div");
  meta.className = "flex items-center gap-2 text-xs text-[#818384] mb-1";
  const authorLink = document.createElement("a");
  authorLink.href = `/u/${authorName}`;
  authorLink.className = "text-[#d7dadc] font-medium hover:underline";
  authorLink.textContent = `u/${authorName}`;
  const bullet = document.createElement("span");
  bullet.textContent = "\u2022";
  const timestamp = document.createElement("span");
  timestamp.textContent = "just now";
  meta.appendChild(authorLink);
  meta.appendChild(bullet);
  meta.appendChild(timestamp);

  // Content.
  const contentDiv = document.createElement("div");
  contentDiv.className = "text-sm mb-2";
  const prose = document.createElement("div");
  prose.className = "prose prose-invert prose-sm max-w-none";
  const p = document.createElement("p");
  p.className = "text-[#d7dadc] mb-2 last:mb-0";
  p.textContent = content;
  prose.appendChild(p);
  contentDiv.appendChild(prose);

  // Action bar with vote spans matching Moltbook's structure.
  const actionBar = document.createElement("div");
  actionBar.className = "flex items-center gap-3 text-xs text-[#818384]";
  const voteSpan = document.createElement("span");
  voteSpan.className = "flex items-center gap-1";
  const upArrow = document.createElement("span");
  upArrow.textContent = "\u25B2";
  upArrow.style.color = UPVOTE_COLOR;
  upArrow.style.cursor = "pointer";
  const countSpan = document.createElement("span");
  countSpan.textContent = "1";
  countSpan.style.color = UPVOTE_COLOR;
  const downArrow = document.createElement("span");
  downArrow.textContent = "\u25BC";
  downArrow.style.color = "#7193ff";
  downArrow.style.opacity = "0.3";
  downArrow.style.cursor = "not-allowed";
  downArrow.title = "Comment downvoting not supported by Moltbook";
  voteSpan.appendChild(upArrow);
  voteSpan.appendChild(countSpan);
  voteSpan.appendChild(downArrow);
  actionBar.appendChild(voteSpan);

  wrapper.appendChild(meta);
  wrapper.appendChild(contentDiv);
  wrapper.appendChild(actionBar);
  outer.appendChild(wrapper);

  return outer;
}

// Attach a functional upvote toggle handler to an optimistically inserted comment.
function attachUpvoteHandler(commentEl: HTMLElement, commentId: string, apiKey: string) {
  const voteSpan = commentEl.querySelector("span.flex.items-center.gap-1");
  if (!voteSpan) return;
  const spans = voteSpan.querySelectorAll("span");
  if (spans.length < 3) return;

  const upArrow = spans[0] as HTMLElement;
  const countSpan = spans[1] as HTMLElement;

  upArrow.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Show loading state.
    upArrow.style.opacity = "0.5";
    const currentVote = await getVote("comment", commentId);
    const isToggleOff = currentVote === "up";

    const result = await upvoteComment(apiKey, commentId);
    upArrow.style.opacity = "1";

    if (result.success) {
      const currentCount = parseInt(countSpan.textContent || "0", 10);
      if (isToggleOff) {
        // Toggle off: remove upvote.
        await removeVote("comment", commentId);
        countSpan.textContent = String(currentCount - 1);
        upArrow.style.color = "";
        countSpan.style.color = "";
      } else {
        // Toggle on: add upvote.
        await setVote("comment", commentId, "up");
        countSpan.textContent = String(currentCount + 1);
        upArrow.style.color = UPVOTE_COLOR;
        countSpan.style.color = UPVOTE_COLOR;
      }
    }
  });
}

function incrementCommentCount() {
  // Find the "Comments (N)" header and increment the count.
  const headers = document.querySelectorAll("h2");
  for (const h2 of headers) {
    const match = h2.textContent?.match(/^Comments\s*\(([0-9,]+)\)/);
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ""), 10);
      const newCount = (count + 1).toLocaleString();
      h2.textContent = `Comments (${newCount})`;
      break;
    }
  }
}

// ============================================================================
// Top-Level Comment Form Injection
// ============================================================================

function findCommentsHeader(): HTMLElement | null {
  const headers = document.querySelectorAll("h2");
  for (const h2 of headers) {
    if (h2.textContent?.match(/^Comments\s*\(/)) {
      return h2 as HTMLElement;
    }
  }
  return null;
}

function injectCommentForm(postId: string): boolean {
  // Don't double-inject.
  if (document.getElementById(COMMENT_FORM_ID)) return true;

  const commentsHeader = findCommentsHeader();
  if (!commentsHeader) return false;

  const container = document.createElement("div");
  container.id = COMMENT_FORM_ID;
  container.style.marginTop = "0.5rem";
  container.style.marginBottom = "0.75rem";

  // Insert after the comments header.
  commentsHeader.after(container);

  const shadow = container.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  const handleSuccess = async (commentId: string, content: string) => {
    const authorName = await getAgentName();
    const commentEl = buildCommentElement(authorName, content);

    // Insert inside the existing comment card as the first child.
    // All comments live inside a single card container.
    const card = commentsHeader.parentElement?.querySelector(
      "div.bg-\\[\\#1a1a1b\\].border.border-\\[\\#343536\\].rounded-lg",
    );
    if (card) {
      card.insertBefore(commentEl, card.firstChild);
    }

    incrementCommentCount();

    // Attach functional upvote toggle handler.
    const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
    const authData = stored[AUTH_STORAGE_KEY] as { apiKey?: string } | undefined;
    if (authData?.apiKey) {
      attachUpvoteHandler(commentEl, commentId, authData.apiKey);
    }

    // Add the new comment to the lookup map so it can be replied to.
    addToCommentLookupMap(postId, authorName, content, commentId);

    // Inject a reply button on the new comment after a brief delay.
    setTimeout(() => injectReplyButtons(postId), 100);

    console.log(`[Cercia Commenting] Comment inserted: ${commentId}`);
  };

  const root = ReactDOM.createRoot(mountPoint);
  root.render(<CommentForm postId={postId} onSuccess={handleSuccess} />);

  return true;
}

// ============================================================================
// Reply Button Injection
// ============================================================================

function injectReplyButtons(postId: string) {
  // Find the comments section (the parent of the comments header).
  const commentsHeader = findCommentsHeader();
  if (!commentsHeader) return;
  const commentsSection = commentsHeader.parentElement;
  if (!commentsSection) return;

  // Find all comment elements within the comments section.
  const commentElements = commentsSection.querySelectorAll("div.py-2");

  for (const commentEl of commentElements) {
    // Skip already-processed comments.
    if ((commentEl as HTMLElement).dataset.cerciaReplyAdded) continue;

    // Find the action bar (last div.flex child with vote spans).
    const actionBars = commentEl.querySelectorAll(":scope > div.flex.items-center.gap-3.text-xs");
    if (actionBars.length === 0) continue;
    const actionBar = actionBars[actionBars.length - 1] as HTMLElement;

    // Verify this is actually a comment action bar (contains vote arrows).
    const hasVoteArrows = actionBar.querySelector("span.flex.items-center.gap-1");
    if (!hasVoteArrows) continue;

    // Create the reply button.
    const replyButton = document.createElement("span");
    replyButton.textContent = "Reply";
    replyButton.style.cursor = "pointer";
    replyButton.style.color = "#818384";
    replyButton.style.fontWeight = "600";
    replyButton.style.transition = "color 0.2s";
    replyButton.addEventListener("mouseenter", () => {
      replyButton.style.color = "#d7dadc";
    });
    replyButton.addEventListener("mouseleave", () => {
      replyButton.style.color = "#818384";
    });

    replyButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleReplyClick(commentEl as HTMLElement, postId);
    });

    actionBar.appendChild(replyButton);
    (commentEl as HTMLElement).dataset.cerciaReplyAdded = "true";
  }
}

function handleReplyClick(commentEl: HTMLElement, postId: string) {
  // `commentEl` is the `div.py-2`. Its parent is the outer `<div class="">` wrapper.
  const outerWrapper = commentEl.parentElement;
  if (!outerWrapper) return;

  // Toggle: if reply form already open for this comment, close it.
  const existingForm = outerWrapper.querySelector(`[id^="cercia-reply-"]`);
  if (existingForm) {
    existingForm.remove();
    return;
  }

  // Resolve comment ID from DOM content.
  const userLink = commentEl.querySelector('a[href^="/u/"]');
  const authorName = userLink?.textContent?.trim().replace(/^u\//, "") || "";
  const proseDiv = commentEl.querySelector(".prose");
  const contentSnippet = proseDiv?.textContent?.trim().slice(0, 100) || "";

  const commentId = lookupCommentId(postId, authorName, contentSnippet);
  if (!commentId) {
    console.warn(`[Cercia Commenting] Could not resolve comment ID for ${authorName}'s comment.`);
    return;
  }

  // Create reply form container inside the outer wrapper, after the py-2 comment.
  const containerId = `cercia-reply-${commentId}`;
  const container = document.createElement("div");
  container.id = containerId;
  container.style.marginTop = "0.5rem";
  container.style.marginBottom = "0.5rem";
  container.style.marginLeft = "1rem";

  commentEl.after(container);

  const shadow = container.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  const handleSuccess = async (replyId: string, content: string) => {
    const authorName = await getAgentName();
    const replyEl = buildCommentElement(authorName, content);

    // Find or create the reply wrapper inside the outer wrapper.
    // In Moltbook, replies sit in `div.ml-4.pl-4.border-l-2` as a sibling of the py-2 div.
    let replyWrapper = outerWrapper.querySelector(":scope > div.ml-4.pl-4.border-l-2");

    if (!replyWrapper) {
      replyWrapper = document.createElement("div");
      replyWrapper.className = "ml-4 pl-4 border-l-2 border-[#343536]";
      outerWrapper.appendChild(replyWrapper);
    }

    // Insert the reply at the end of the wrapper.
    replyWrapper.appendChild(replyEl);

    incrementCommentCount();

    // Attach functional upvote toggle handler.
    const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
    const authData = stored[AUTH_STORAGE_KEY] as { apiKey?: string } | undefined;
    if (authData?.apiKey) {
      attachUpvoteHandler(replyEl, replyId, authData.apiKey);
    }

    // Add to lookup map for further replies.
    addToCommentLookupMap(postId, authorName, content, replyId);

    // Remove the reply form.
    container.remove();

    // Inject reply button on the new reply.
    setTimeout(() => injectReplyButtons(postId), 100);

    console.log(`[Cercia Commenting] Reply inserted: ${replyId}`);
  };

  const handleCancel = () => {
    container.remove();
  };

  const root = ReactDOM.createRoot(mountPoint);
  root.render(
    <ReplyForm
      postId={postId}
      parentId={commentId}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />,
  );
}

// ============================================================================
// Page Initialization
// ============================================================================

function getPostId(): string | null {
  const match = window.location.pathname.match(POST_PATTERN);
  return match ? match[1] : null;
}

function removeExisting() {
  document.getElementById(COMMENT_FORM_ID)?.remove();
  // Remove any open reply forms.
  document.querySelectorAll('[id^="cercia-reply-"]').forEach((el) => el.remove());
}

async function initialize() {
  const postId = getPostId();
  if (!postId) {
    removeExisting();
    return;
  }

  // Auth gate: only inject if logged in.
  const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
  const data = stored[AUTH_STORAGE_KEY] as { apiKey?: string } | undefined;
  if (!data?.apiKey) return;

  // Fetch comment data for ID resolution.
  await fetchCommentLookupMap(postId);

  // Try to inject the comment form and reply buttons.
  const injected = injectCommentForm(postId);
  if (injected) {
    injectReplyButtons(postId);
    return;
  }

  // If page hasn't loaded yet, use a MutationObserver.
  const observer = new MutationObserver(() => {
    const success = injectCommentForm(postId);
    if (success) {
      injectReplyButtons(postId);
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
}

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",

  main() {
    console.log("[Cercia Commenting] Content script loaded");

    // Wait for the page to render before initializing.
    setTimeout(initialize, 500);

    onNavigate(() => {
      removeExisting();
      clearCommentLookupCache();
      setTimeout(initialize, 500);
    });
  },
});
