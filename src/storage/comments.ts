// Local cache for user-created comments.
// The API doesn't provide an endpoint to retrieve a user's own comments,
// so we store them locally for reference.

const STORAGE_KEY = "cercia_my_comments";

export interface CachedComment {
  id: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: string;
}

export async function addCreatedComment(comment: CachedComment): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const comments = (stored[STORAGE_KEY] as CachedComment[]) || [];
  comments.unshift(comment);
  await browser.storage.local.set({ [STORAGE_KEY]: comments });
}

export async function getCreatedComments(): Promise<CachedComment[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as CachedComment[]) || [];
}
