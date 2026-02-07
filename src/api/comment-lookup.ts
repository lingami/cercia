// Shared comment ID lookup utilities.
// Used by both the voting and commenting content scripts to resolve DOM
// comment elements back to API comment IDs.

const API_BASE = "https://www.moltbook.com/api/v1";

export interface ApiComment {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  downvotes: number;
  replies?: ApiComment[];
}

// Normalize content for matching DOM text to API content.
export function normalizeContent(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40);
}

// Create a lookup key from author name and content snippet.
export function makeCommentLookupKey(authorName: string, contentSnippet: string): string {
  return `${authorName.toLowerCase()}:${normalizeContent(contentSnippet)}`;
}

// Build a lookup map from all comments in an API response.
export function buildCommentLookupMap(comments: ApiComment[]): Map<string, string> {
  const map = new Map<string, string>();

  function addComments(commentList: ApiComment[]) {
    for (const comment of commentList) {
      const key = makeCommentLookupKey(comment.author.name, comment.content);
      map.set(key, comment.id);
      if (comment.replies && comment.replies.length > 0) {
        addComments(comment.replies);
      }
    }
  }

  addComments(comments);
  return map;
}

// Cache for comment lookup maps (postId -> Map of lookup key -> commentId).
const commentLookupCache = new Map<string, Map<string, string>>();

// Fetch all comments for a post and build the lookup map (cached).
export async function fetchCommentLookupMap(postId: string): Promise<Map<string, string>> {
  const cached = commentLookupCache.get(postId);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${API_BASE}/posts/${postId}`);
    const data = await response.json();
    if (data.success && data.comments) {
      const map = buildCommentLookupMap(data.comments);
      commentLookupCache.set(postId, map);
      console.log(`[Cercia] Built comment lookup map with ${map.size} entries`);
      return map;
    }
  } catch (error) {
    console.error("[Cercia] Failed to fetch post comments:", error);
  }

  const emptyMap = new Map<string, string>();
  commentLookupCache.set(postId, emptyMap);
  return emptyMap;
}

// Clear the lookup cache (call on navigation).
export function clearCommentLookupCache(): void {
  commentLookupCache.clear();
}

// Look up a comment ID from the cached map.
export function lookupCommentId(
  postId: string,
  authorName: string,
  contentSnippet: string,
): string | null {
  const map = commentLookupCache.get(postId);
  if (!map) return null;
  const key = makeCommentLookupKey(authorName, contentSnippet);
  return map.get(key) || null;
}

// Add an entry to the cached lookup map (for optimistically inserted comments).
export function addToCommentLookupMap(
  postId: string,
  authorName: string,
  content: string,
  commentId: string,
): void {
  let map = commentLookupCache.get(postId);
  if (!map) {
    map = new Map();
    commentLookupCache.set(postId, map);
  }
  const key = makeCommentLookupKey(authorName, content);
  map.set(key, commentId);
}
