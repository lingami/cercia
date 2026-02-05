// API response interception utilities.
// Captures Moltbook API responses to extract post/comment IDs and metadata.

export interface InterceptedPost {
  id: string;
  title: string;
  upvotes: number;
  downvotes: number;
  authorName: string;
  submolt?: string;
}

export interface InterceptedComment {
  id: string;
  postId: string;
  content: string;
  authorName: string;
  upvotes: number;
  downvotes: number;
  parentId?: string;
}

export interface ApiInterceptData {
  posts: Map<string, InterceptedPost>;
  comments: Map<string, InterceptedComment>;
  // Map from "authorName:contentSnippet" to comment ID for quick lookup.
  commentLookup: Map<string, string>;
}

// Global storage for intercepted data.
const interceptedData: ApiInterceptData = {
  posts: new Map(),
  comments: new Map(),
  commentLookup: new Map(),
};

// Normalize content for matching DOM text to API content.
function normalizeContent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40);
}

// Create a lookup key from author name and content snippet.
function makeCommentLookupKey(authorName: string, contentSnippet: string): string {
  return `${authorName.toLowerCase()}:${normalizeContent(contentSnippet)}`;
}

// Process a post object from API response.
function processPost(post: Record<string, unknown>, submolt?: string): void {
  if (!post.id || typeof post.id !== "string") return;

  const interceptedPost: InterceptedPost = {
    id: post.id,
    title: (post.title as string) || "",
    upvotes: (post.upvotes as number) || 0,
    downvotes: (post.downvotes as number) || 0,
    authorName: ((post.author as Record<string, unknown>)?.name as string) || "",
    submolt: submolt || (post.submolt as string),
  };

  interceptedData.posts.set(post.id, interceptedPost);
}

// Process a comment object from API response (recursive for replies).
function processComment(comment: Record<string, unknown>, postId: string, parentId?: string): void {
  if (!comment.id || typeof comment.id !== "string") return;

  const authorName = ((comment.author as Record<string, unknown>)?.name as string) || "";
  const content = (comment.content as string) || "";

  const interceptedComment: InterceptedComment = {
    id: comment.id,
    postId,
    content,
    authorName,
    upvotes: (comment.upvotes as number) || 0,
    downvotes: (comment.downvotes as number) || 0,
    parentId,
  };

  interceptedData.comments.set(comment.id, interceptedComment);

  // Add to lookup map for DOM matching.
  const lookupKey = makeCommentLookupKey(authorName, content);
  interceptedData.commentLookup.set(lookupKey, comment.id);

  // Process replies recursively.
  const replies = comment.replies as Record<string, unknown>[] | undefined;
  if (replies && Array.isArray(replies)) {
    for (const reply of replies) {
      processComment(reply, postId, comment.id);
    }
  }
}

// Process an API response based on the URL pattern.
function processApiResponse(url: string, data: unknown): void {
  if (!data || typeof data !== "object") return;

  const response = data as Record<string, unknown>;

  // Skip unsuccessful responses.
  if (response.success === false) return;

  try {
    // Posts list endpoint: /api/v1/posts or /api/v1/submolts/{name}/posts
    if (url.includes("/posts") && !url.includes("/posts/")) {
      const posts = response.posts as Record<string, unknown>[] | undefined;
      if (posts && Array.isArray(posts)) {
        for (const post of posts) {
          processPost(post);
        }
        console.log(`[Cercia] Intercepted ${posts.length} posts from API`);
      }
    }

    // Single post endpoint: /api/v1/posts/{id}
    if (url.match(/\/posts\/[a-f0-9-]+$/)) {
      // The response itself is the post data.
      if (response.id) {
        processPost(response);
      }

      // Process comments if present.
      const comments = response.comments as Record<string, unknown>[] | undefined;
      if (comments && Array.isArray(comments)) {
        const postId = response.id as string;
        for (const comment of comments) {
          processComment(comment, postId);
        }
        console.log(
          `[Cercia] Intercepted post ${postId} with ${interceptedData.commentLookup.size} comments`,
        );
      }
    }

    // User posts endpoint: /api/v1/users/{name}/posts
    if (url.match(/\/users\/[^/]+\/posts/)) {
      const posts = response.posts as Record<string, unknown>[] | undefined;
      if (posts && Array.isArray(posts)) {
        for (const post of posts) {
          processPost(post);
        }
        console.log(`[Cercia] Intercepted ${posts.length} user posts from API`);
      }
    }

    // Submolt posts endpoint: /api/v1/submolts/{name}/posts
    if (url.match(/\/submolts\/[^/]+\/posts/)) {
      const posts = response.posts as Record<string, unknown>[] | undefined;
      const submoltName = url.match(/\/submolts\/([^/]+)\/posts/)?.[1];
      if (posts && Array.isArray(posts)) {
        for (const post of posts) {
          processPost(post, submoltName);
        }
        console.log(`[Cercia] Intercepted ${posts.length} submolt posts from API`);
      }
    }
  } catch (error) {
    console.error("[Cercia] Error processing API response:", error);
  }
}

// Get a post by ID from intercepted data.
export function getInterceptedPost(postId: string): InterceptedPost | undefined {
  return interceptedData.posts.get(postId);
}

// Get a comment by ID from intercepted data.
export function getInterceptedComment(commentId: string): InterceptedComment | undefined {
  return interceptedData.comments.get(commentId);
}

// Look up a comment ID by author name and content snippet.
export function lookupCommentId(authorName: string, contentSnippet: string): string | undefined {
  const key = makeCommentLookupKey(authorName, contentSnippet);
  return interceptedData.commentLookup.get(key);
}

// Get all intercepted posts.
export function getAllInterceptedPosts(): Map<string, InterceptedPost> {
  return interceptedData.posts;
}

// Get all intercepted comments for a post.
export function getCommentsForPost(postId: string): InterceptedComment[] {
  const comments: InterceptedComment[] = [];
  for (const comment of interceptedData.comments.values()) {
    if (comment.postId === postId) {
      comments.push(comment);
    }
  }
  return comments;
}

// Clear all intercepted data (useful on navigation).
export function clearInterceptedData(): void {
  interceptedData.posts.clear();
  interceptedData.comments.clear();
  interceptedData.commentLookup.clear();
}

// The injection script that will be inserted into the page context.
// This needs to be a string because it runs in the page's JS context, not the extension's.
export const INTERCEPTOR_SCRIPT = `
(function() {
  // Avoid double-injection.
  if (window.__cerciaInterceptorInstalled) return;
  window.__cerciaInterceptorInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    // Only intercept Moltbook API responses.
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.includes('/api/v1/')) {
      try {
        // Clone the response so we can read it without consuming the original.
        const clone = response.clone();
        const contentType = clone.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          const data = await clone.json();

          // Dispatch event for the content script to receive.
          window.dispatchEvent(new CustomEvent('cercia-api-response', {
            detail: { url, data }
          }));
        }
      } catch (e) {
        // Ignore parsing errors - response might not be JSON.
      }
    }

    return response;
  };

  // Also intercept XMLHttpRequest for completeness.
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._cerciaUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      const url = this._cerciaUrl || '';
      if (url.includes('/api/v1/')) {
        try {
          const contentType = this.getResponseHeader('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = JSON.parse(this.responseText);
            window.dispatchEvent(new CustomEvent('cercia-api-response', {
              detail: { url, data }
            }));
          }
        } catch (e) {
          // Ignore parsing errors.
        }
      }
    });
    return originalXHRSend.apply(this, args);
  };

  console.log('[Cercia] API interceptor installed');
})();
`;

// Install the interceptor by injecting the script into the page.
export function installInterceptor(): void {
  // Inject the script into the page context.
  const script = document.createElement("script");
  script.textContent = INTERCEPTOR_SCRIPT;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // Listen for intercepted API responses.
  window.addEventListener("cercia-api-response", ((event: CustomEvent) => {
    const { url, data } = event.detail;
    processApiResponse(url, data);
  }) as EventListener);

  console.log("[Cercia] API interceptor listener installed");
}
