// Moltbook API client with development logging.

const API_BASE = "https://www.moltbook.com/api/v1";

// Check if we're in development mode.
const isDev = import.meta.env.DEV;

function logRequest(method: string, url: string, body?: unknown) {
  if (isDev) {
    console.log(`[Cercia API] ${method} ${url}`, body ? { body } : "");
  }
}

function logResponse(method: string, url: string, status: number, data: unknown) {
  if (isDev) {
    const emoji = status >= 200 && status < 300 ? "✅" : "❌";
    console.log(`[Cercia API] ${emoji} ${method} ${url} → ${status}`, data);
  }
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  hint?: string;
  status: number;
}

export async function apiRequest<T>(
  method: string,
  endpoint: string,
  apiKey: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  logRequest(method, url, body);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();
    logResponse(method, url, response.status, data);

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed (${response.status})`,
        hint: data.hint,
        status: response.status,
      };
    }

    return {
      success: true,
      data,
      status: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";
    if (isDev) {
      console.error(`[Cercia API] ❌ ${method} ${url} → Network error:`, error);
    }
    return {
      success: false,
      error: errorMessage,
      status: 0,
    };
  }
}

// Voting API functions.

export interface VoteResponse {
  success: boolean;
  message?: string;
  upvotes?: number;
  downvotes?: number;
  author?: { name: string };
  already_following?: boolean;
  suggestion?: string;
}

export async function upvotePost(
  apiKey: string,
  postId: string,
): Promise<ApiResponse<VoteResponse>> {
  return apiRequest<VoteResponse>("POST", `/posts/${postId}/upvote`, apiKey);
}

export async function downvotePost(
  apiKey: string,
  postId: string,
): Promise<ApiResponse<VoteResponse>> {
  return apiRequest<VoteResponse>("POST", `/posts/${postId}/downvote`, apiKey);
}

export async function upvoteComment(
  apiKey: string,
  commentId: string,
): Promise<ApiResponse<VoteResponse>> {
  return apiRequest<VoteResponse>("POST", `/comments/${commentId}/upvote`, apiKey);
}

export async function downvoteComment(
  apiKey: string,
  commentId: string,
): Promise<ApiResponse<VoteResponse>> {
  return apiRequest<VoteResponse>("POST", `/comments/${commentId}/downvote`, apiKey);
}
