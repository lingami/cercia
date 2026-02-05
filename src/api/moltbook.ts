// Moltbook API client for the Cercia extension.

const API_BASE = "https://www.moltbook.com/api/v1";

export interface RegisterResponse {
  agent: {
    name: string;
    api_key: string;
    claim_url: string;
    verification_code: string;
  };
  important: string;
}

export interface AgentProfile {
  name: string;
  displayName?: string;
  description: string;
  karma: number;
  follower_count?: number;
  following_count?: number;
  // API returns camelCase.
  isClaimed: boolean;
  status?: string;
  createdAt: string;
}

export interface ApiError {
  success: false;
  error: string;
  hint?: string;
}

// Special result for unclaimed agents during login.
export interface UnclaimedAgentResult {
  success: false;
  unclaimed: true;
  claimUrl: string;
  error: string;
}

export type ApiResult<T> = { success: true; data: T } | ApiError | UnclaimedAgentResult;

// Register a new agent.
export async function registerAgent(
  name: string,
  description: string,
): Promise<ApiResult<RegisterResponse>> {
  try {
    const response = await fetch(`${API_BASE}/agents/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Registration failed (${response.status})`,
        hint: data.hint,
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Validate an API key by fetching the agent's profile.
// For unclaimed agents, the API returns an error with a claim URL in the hint.
export async function validateApiKey(
  apiKey: string,
): Promise<ApiResult<AgentProfile> | UnclaimedAgentResult> {
  try {
    const response = await fetch(`${API_BASE}/agents/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Check if this is an unclaimed agent error.
      if (data.error === "Agent not yet claimed" && data.hint) {
        // Extract claim URL from hint (format: "...Send them this link: https://...").
        const urlMatch = data.hint.match(/https:\/\/[^\s]+/);
        if (urlMatch) {
          return {
            success: false,
            unclaimed: true,
            claimUrl: urlMatch[0],
            error: data.error,
          };
        }
      }

      return {
        success: false,
        error: data.error || `Invalid API key (${response.status})`,
        hint: data.hint,
      };
    }

    // Map snake_case API response to camelCase AgentProfile.
    const agent = data.agent || data;
    const profile: AgentProfile = {
      name: agent.name,
      displayName: agent.display_name,
      description: agent.description || "",
      karma: agent.karma || 0,
      follower_count: agent.follower_count,
      following_count: agent.following_count,
      isClaimed: agent.is_claimed ?? false,
      status: agent.status,
      createdAt: agent.created_at,
    };
    return { success: true, data: profile };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Generate a Twitter intent URL for claiming an agent.
export function getClaimTweetUrl(agentName: string, verificationCode: string): string {
  const tweetText = `I'm claiming my AI agent "${agentName}" on @moltbook 🦞

Verification: ${verificationCode}`;

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
}

// Status response for unclaimed agents.
export interface AgentStatus {
  status: string;
  message: string;
  agent: {
    id: string;
    name: string;
  };
  claimUrl: string;
  verificationCode?: string;
}

// Get agent status (works for unclaimed agents).
export async function getAgentStatus(apiKey: string): Promise<ApiResult<AgentStatus>> {
  try {
    const response = await fetch(`${API_BASE}/agents/status`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to get status (${response.status})`,
        hint: data.hint,
      };
    }

    // Extract verification code from claim URL if possible.
    // Format: moltbook_claim_XXXXX where XXXXX is the verification-like part.
    let verificationCode: string | undefined;
    const claimUrl = data.claim_url || "";
    const match = claimUrl.match(/moltbook_claim_([A-Za-z0-9_-]+)/);
    if (match) {
      verificationCode = match[1];
    }

    return {
      success: true,
      data: {
        status: data.status,
        message: data.message,
        agent: data.agent,
        claimUrl: claimUrl,
        verificationCode,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Claim info response from the claim token endpoint.
export interface ClaimInfo {
  id: string;
  name: string;
  description: string | null;
  verification_code: string;
  is_claimed: boolean;
  created_at: string;
}

// Get claim info from a claim token (extracted from claim URL).
// This returns the agent info including verification_code without needing the API key.
export async function getClaimInfo(claimToken: string): Promise<ApiResult<ClaimInfo>> {
  try {
    const response = await fetch(
      `${API_BASE}/agents/claim?token=${encodeURIComponent(claimToken)}`,
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Failed to get claim info (${response.status})`,
        hint: data.hint,
      };
    }

    return { success: true, data: data.agent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Extract claim token from a claim URL.
export function extractClaimToken(claimUrl: string): string | null {
  const match = claimUrl.match(/moltbook_claim_[A-Za-z0-9_-]+/);
  return match ? match[0] : null;
}

// Verify tweet to complete the claim process.
// Requires the claim token (from claim URL) and the tweet URL where the user posted verification.
export async function verifyTweet(
  apiKey: string,
  claimToken: string,
  tweetUrl: string,
): Promise<ApiResult<{ claimed: boolean }>> {
  try {
    const response = await fetch(`${API_BASE}/agents/verify-tweet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: claimToken,
        tweet_url: tweetUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Verification failed (${response.status})`,
        hint: data.hint,
      };
    }

    return { success: true, data: { claimed: data.claimed ?? true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
