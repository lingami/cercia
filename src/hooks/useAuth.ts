// Authentication hook for managing Moltbook credentials.

import { useEffect, useState } from "react";
import {
  registerAgent,
  validateApiKey,
  getClaimInfo,
  extractClaimToken,
  verifyTweet as verifyTweetApi,
  type AgentProfile,
} from "../api/moltbook";

const STORAGE_KEY = "cercia_auth";

interface StoredAuth {
  apiKey: string;
  claimUrl?: string;
  verificationCode?: string;
}

export interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  agent: AgentProfile | null;
  apiKey: string | null;
  claimUrl: string | null;
  verificationCode: string | null;
}

export interface AuthActions {
  signUp: (name: string, description: string) => Promise<{ success: boolean; error?: string }>;
  logIn: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  logOut: () => void;
  refreshProfile: () => Promise<void>;
  verifyTweet: (tweetUrl: string) => Promise<{ success: boolean; error?: string }>;
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    agent: null,
    apiKey: null,
    claimUrl: null,
    verificationCode: null,
  });

  // Load saved credentials on mount.
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const stored = await browser.storage.local.get(STORAGE_KEY);
        const data = stored[STORAGE_KEY] as StoredAuth | undefined;

        if (data?.apiKey) {
          // Validate the stored API key.
          const result = await validateApiKey(data.apiKey);

          if (result.success) {
            // Claimed agent - normal login. Cache agent for navbar.
            const cachedAgent = { name: result.data.name, isClaimed: result.data.isClaimed };
            await browser.storage.local.set({
              [STORAGE_KEY]: { ...data, cachedAgent },
            });
            setState({
              isLoading: false,
              isLoggedIn: true,
              agent: result.data,
              apiKey: data.apiKey,
              claimUrl: data.claimUrl || null,
              verificationCode: data.verificationCode || null,
            });
            return;
          }

          // Check if this is an unclaimed agent (either by unclaimed flag or error message).
          const isUnclaimed =
            ("unclaimed" in result && result.unclaimed) || result.error === "Agent not yet claimed";
          if (isUnclaimed) {
            // Get the claim URL from the result or stored data.
            const claimUrl = ("unclaimed" in result ? result.claimUrl : null) || data.claimUrl;

            if (claimUrl) {
              // Extract the claim token and get full agent info including verification code.
              const claimToken = extractClaimToken(claimUrl);
              if (claimToken) {
                const claimResult = await getClaimInfo(claimToken);
                if (claimResult.success) {
                  const { name, description, verification_code } = claimResult.data;

                  // Update stored credentials with verification code if we didn't have it.
                  if (!data.verificationCode) {
                    await browser.storage.local.set({
                      [STORAGE_KEY]: { ...data, verificationCode: verification_code },
                    });
                  }

                  // Create a partial agent profile for the unclaimed state.
                  const partialAgent: AgentProfile = {
                    name,
                    description: description || "",
                    karma: 0,
                    isClaimed: false,
                    createdAt: new Date().toISOString(),
                  };

                  setState({
                    isLoading: false,
                    isLoggedIn: true,
                    agent: partialAgent,
                    apiKey: data.apiKey,
                    claimUrl,
                    verificationCode: data.verificationCode || verification_code,
                  });
                  return;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load auth:", error);
      }

      setState((prev) => ({ ...prev, isLoading: false }));
    };

    loadAuth();
  }, []);

  // Listen for storage changes (e.g., logout from navbar).
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } },
      areaName: string,
    ) => {
      if (areaName !== "local" || !(STORAGE_KEY in changes)) {
        return;
      }

      const change = changes[STORAGE_KEY];

      // If storage was cleared (logout), reset to logged-out state.
      if (!change.newValue) {
        setState({
          isLoading: false,
          isLoggedIn: false,
          agent: null,
          apiKey: null,
          claimUrl: null,
          verificationCode: null,
        });
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const signUp = async (
    name: string,
    description: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await registerAgent(name, description);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const { name: agentName, api_key, claim_url, verification_code } = result.data.agent;

    // Save credentials.
    await browser.storage.local.set({
      [STORAGE_KEY]: {
        apiKey: api_key,
        claimUrl: claim_url,
        verificationCode: verification_code,
      },
    });

    // Create a partial profile for the unclaimed agent.
    // We don't call validateApiKey here because unclaimed agents return an error.
    const partialAgent: AgentProfile = {
      name: agentName,
      description: description,
      karma: 0,
      isClaimed: false,
      createdAt: new Date().toISOString(),
    };

    setState({
      isLoading: false,
      isLoggedIn: true,
      agent: partialAgent,
      apiKey: api_key,
      claimUrl: claim_url,
      verificationCode: verification_code,
    });

    return { success: true };
  };

  const logIn = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    const result = await validateApiKey(apiKey);

    if (result.success) {
      // Claimed agent - normal login. Cache agent for navbar.
      const cachedAgent = { name: result.data.name, isClaimed: result.data.isClaimed };
      await browser.storage.local.set({
        [STORAGE_KEY]: { apiKey, cachedAgent },
      });

      setState({
        isLoading: false,
        isLoggedIn: true,
        agent: result.data,
        apiKey,
        claimUrl: null,
        verificationCode: null,
      });

      return { success: true };
    }

    // Check if this is an unclaimed agent (either by unclaimed flag or error message).
    const isUnclaimed =
      ("unclaimed" in result && result.unclaimed) || result.error === "Agent not yet claimed";
    if (isUnclaimed) {
      // Get the claim URL from the result.
      const claimUrl = "unclaimed" in result ? result.claimUrl : null;

      if (!claimUrl) {
        return { success: false, error: "Could not find claim URL for unclaimed agent" };
      }

      // Extract the claim token and get full agent info including verification code.
      const claimToken = extractClaimToken(claimUrl);
      if (!claimToken) {
        return { success: false, error: "Could not extract claim token from URL" };
      }

      const claimResult = await getClaimInfo(claimToken);
      if (!claimResult.success) {
        return { success: false, error: claimResult.error };
      }

      const { name, description, verification_code } = claimResult.data;

      // Create a partial agent profile for the unclaimed state.
      const partialAgent: AgentProfile = {
        name,
        description: description || "",
        karma: 0,
        isClaimed: false,
        createdAt: new Date().toISOString(),
      };

      // Save credentials with claim URL, verification code, and cached agent for navbar.
      const cachedAgent = { name, isClaimed: false };
      await browser.storage.local.set({
        [STORAGE_KEY]: { apiKey, claimUrl, verificationCode: verification_code, cachedAgent },
      });

      setState({
        isLoading: false,
        isLoggedIn: true,
        agent: partialAgent,
        apiKey,
        claimUrl,
        verificationCode: verification_code,
      });

      return { success: true };
    }

    return { success: false, error: result.error };
  };

  const logOut = async () => {
    await browser.storage.local.remove(STORAGE_KEY);
    setState({
      isLoading: false,
      isLoggedIn: false,
      agent: null,
      apiKey: null,
      claimUrl: null,
      verificationCode: null,
    });
  };

  const refreshProfile = async () => {
    if (!state.apiKey) return;

    const result = await validateApiKey(state.apiKey);
    if (result.success) {
      setState((prev) => ({
        ...prev,
        agent: result.data,
      }));
    }
  };

  const verifyTweet = async (tweetUrl: string): Promise<{ success: boolean; error?: string }> => {
    if (!state.apiKey) {
      return { success: false, error: "Not logged in" };
    }

    if (!state.claimUrl) {
      return { success: false, error: "No claim URL available" };
    }

    const claimToken = extractClaimToken(state.claimUrl);
    if (!claimToken) {
      return { success: false, error: "Could not extract claim token" };
    }

    const result = await verifyTweetApi(state.apiKey, claimToken, tweetUrl);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Refresh the profile to get updated claim status.
    await refreshProfile();

    return { success: true };
  };

  return { ...state, signUp, logIn, logOut, refreshProfile, verifyTweet };
}
