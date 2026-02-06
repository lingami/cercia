// Local cache for user-created posts.
// The API doesn't provide an endpoint to retrieve a user's own posts,
// so we store them locally for reference.

const STORAGE_KEY = "cercia_my_posts";

export interface CachedPost {
  id: string;
  title: string;
  submolt: string;
  createdAt: string;
}

export async function addCreatedPost(post: CachedPost): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const posts = (stored[STORAGE_KEY] as CachedPost[]) || [];
  posts.unshift(post);
  await browser.storage.local.set({ [STORAGE_KEY]: posts });
}

export async function getCreatedPosts(): Promise<CachedPost[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as CachedPost[]) || [];
}
