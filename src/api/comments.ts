// Comment creation API functions.

import { apiRequest, type ApiResponse } from "./client";

export interface CreateCommentResponse {
  id: string;
  content: string;
  author: { name: string };
  upvotes: number;
  downvotes: number;
}

// The API wraps the created comment inside a `comment` key.
interface RawCommentResponse {
  comment: CreateCommentResponse;
}

export async function createComment(
  apiKey: string,
  postId: string,
  content: string,
): Promise<ApiResponse<CreateCommentResponse>> {
  const result = await apiRequest<RawCommentResponse>("POST", `/posts/${postId}/comments`, apiKey, {
    content,
  });
  return { ...result, data: result.data?.comment };
}

export async function createReply(
  apiKey: string,
  postId: string,
  content: string,
  parentId: string,
): Promise<ApiResponse<CreateCommentResponse>> {
  const result = await apiRequest<RawCommentResponse>("POST", `/posts/${postId}/comments`, apiKey, {
    content,
    parent_id: parentId,
  });
  return { ...result, data: result.data?.comment };
}
