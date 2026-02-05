// Vote tracking storage utilities.
// Stores user's votes locally since the API doesn't provide vote history.

const STORAGE_KEY = "cercia_votes";

export type VoteType = "up" | "down";

export interface VoteRecord {
  type: VoteType;
  votedAt: string;
}

// Vote storage format: { "post:uuid": { type: "up", votedAt: "..." }, "comment:uuid": { ... } }
type VoteStorage = Record<string, VoteRecord>;

function makeKey(contentType: "post" | "comment", contentId: string): string {
  return `${contentType}:${contentId}`;
}

export async function getVote(
  contentType: "post" | "comment",
  contentId: string,
): Promise<VoteType | null> {
  const key = makeKey(contentType, contentId);
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const votes = (stored[STORAGE_KEY] as VoteStorage) || {};
  return votes[key]?.type || null;
}

export async function setVote(
  contentType: "post" | "comment",
  contentId: string,
  voteType: VoteType,
): Promise<void> {
  const key = makeKey(contentType, contentId);
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const votes = (stored[STORAGE_KEY] as VoteStorage) || {};

  votes[key] = {
    type: voteType,
    votedAt: new Date().toISOString(),
  };

  await browser.storage.local.set({ [STORAGE_KEY]: votes });
}

export async function removeVote(
  contentType: "post" | "comment",
  contentId: string,
): Promise<void> {
  const key = makeKey(contentType, contentId);
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const votes = (stored[STORAGE_KEY] as VoteStorage) || {};

  delete votes[key];

  await browser.storage.local.set({ [STORAGE_KEY]: votes });
}

export async function getAllVotes(): Promise<VoteStorage> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as VoteStorage) || {};
}

// Get votes for multiple content IDs at once (more efficient).
export async function getVotesForIds(
  contentType: "post" | "comment",
  contentIds: string[],
): Promise<Map<string, VoteType>> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const votes = (stored[STORAGE_KEY] as VoteStorage) || {};
  const result = new Map<string, VoteType>();

  for (const id of contentIds) {
    const key = makeKey(contentType, id);
    if (votes[key]) {
      result.set(id, votes[key].type);
    }
  }

  return result;
}
