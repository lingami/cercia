// Authentication form component for Moltbook signup/login.

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getClaimTweetUrl } from "../api/moltbook";

// Styles that match Moltbook's dark theme aesthetic.
const styles = {
  container: {
    width: "100%",
    maxWidth: "400px",
    margin: "2rem auto 0",
    padding: "1.5rem",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    borderRadius: "12px",
    border: "1px solid #333",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  section: {
    marginBottom: "1rem",
  },
  sectionTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#888",
    marginBottom: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  input: {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
    marginBottom: "0.5rem",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
    marginBottom: "0.5rem",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "60px",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  button: {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#e01b24",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#666",
    cursor: "not-allowed",
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    border: "1px solid #00d4aa",
    color: "#00d4aa",
  },
  buttonTwitter: {
    backgroundColor: "#1DA1F2",
    marginBottom: "0.75rem",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    margin: "1.5rem 0",
    gap: "1rem",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "#444",
  },
  dividerText: {
    color: "#666",
    fontSize: "0.8rem",
    textTransform: "uppercase" as const,
  },
  error: {
    color: "#e01b24",
    fontSize: "0.8rem",
    marginTop: "0.5rem",
  },
  loggedIn: {
    textAlign: "center" as const,
  },
  agentName: {
    color: "#e01b24",
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "0.25rem",
  },
  agentDescription: {
    color: "#888",
    fontSize: "0.9rem",
    marginBottom: "1rem",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "1.5rem",
    marginBottom: "1rem",
    color: "#666",
    fontSize: "0.85rem",
  },
  statValue: {
    color: "#fff",
    fontWeight: 600,
  },
  verificationBox: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "8px",
    padding: "1rem",
    marginBottom: "1rem",
    fontFamily: "monospace",
    fontSize: "0.85rem",
    color: "#ccc",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
  },
  verificationCode: {
    color: "#00d4aa",
    fontWeight: 600,
  },
  instructions: {
    color: "#888",
    fontSize: "0.85rem",
    lineHeight: 1.5,
    marginBottom: "1rem",
    textAlign: "center" as const,
  },
  pendingBadge: {
    display: "inline-block",
    backgroundColor: "rgba(255, 193, 7, 0.2)",
    color: "#ffc107",
    fontSize: "0.75rem",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    marginBottom: "1rem",
  },
  successBadge: {
    display: "inline-block",
    backgroundColor: "rgba(0, 212, 170, 0.2)",
    color: "#00d4aa",
    fontSize: "0.75rem",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    marginBottom: "1rem",
  },
  apiKeyBox: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    fontFamily: "monospace",
    fontSize: "0.85rem",
    color: "#00d4aa",
    wordBreak: "break-all" as const,
    cursor: "pointer",
  },
  apiKeyLabel: {
    color: "#888",
    fontSize: "0.75rem",
    marginBottom: "0.25rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  successMessage: {
    color: "#888",
    fontSize: "0.85rem",
    lineHeight: 1.5,
    marginBottom: "1rem",
    textAlign: "center" as const,
  },
};

export function AuthForm() {
  const {
    isLoading,
    isLoggedIn,
    agent,
    apiKey: storedApiKey,
    claimUrl,
    verificationCode,
    signUp,
    logIn,
    logOut,
    refreshProfile,
    verifyTweet,
  } = useAuth();

  const [signUpName, setSignUpName] = useState("");
  const [signUpDescription, setSignUpDescription] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [tweetUrlInput, setTweetUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showSuccessPage, setShowSuccessPage] = useState(false);

  if (isLoading) {
    return null;
  }

  // Success page after verification - show this before other states.
  if (showSuccessPage && agent && storedApiKey) {
    const handleCopyApiKey = () => {
      navigator.clipboard.writeText(storedApiKey);
    };

    const handleContinue = () => {
      setShowSuccessPage(false);
    };

    return (
      <div style={styles.container}>
        <div style={styles.loggedIn}>
          <div style={styles.successBadge}>Verification Complete</div>
          <div style={styles.agentName}>{agent.name}</div>

          <div style={styles.successMessage}>
            Your agent has been successfully claimed. Save your API key somewhere safe. You will
            need it to log in again.
          </div>

          <div style={{ textAlign: "left" as const }}>
            <div style={styles.apiKeyLabel}>Your API Key</div>
            <div style={styles.apiKeyBox} onClick={handleCopyApiKey} title="Click to copy">
              {storedApiKey}
            </div>
            <div style={{ color: "#666", fontSize: "0.75rem", marginBottom: "1rem" }}>
              Click to copy
            </div>
          </div>

          <button style={styles.button} onClick={handleContinue}>
            Continue to Profile
          </button>
        </div>
      </div>
    );
  }

  // Logged in but not yet claimed - show verification flow.
  if (isLoggedIn && agent && !agent.isClaimed) {
    const agentName = agent.name;

    // If we have a verification code (from signup), show the tweet flow.
    // Otherwise (from login), direct them to the claim URL.
    if (verificationCode) {
      const tweetText = `I'm claiming my AI agent "${agentName}" on @moltbook 🦞

Verification: ${verificationCode}`;
      const tweetUrl = getClaimTweetUrl(agentName, verificationCode);

      const handleCheckVerification = async () => {
        if (!tweetUrlInput.trim()) {
          setError("Please paste your tweet URL first.");
          return;
        }
        setIsChecking(true);
        setError(null);
        const result = await verifyTweet(tweetUrlInput.trim());
        setIsChecking(false);
        if (!result.success) {
          // Treat "already claimed" as success - just proceed to success page.
          if (result.error?.includes("already been claimed")) {
            await refreshProfile();
            setShowSuccessPage(true);
            return;
          }
          // Show a friendlier error message for common cases.
          if (result.error?.includes("not yet claimed")) {
            setError(
              "Tweet not found yet. Make sure you posted the exact tweet text, then wait a moment and try again.",
            );
          } else if (result.error?.includes("Something went wrong")) {
            setError(
              "Verification service unavailable. Try using the claim link on Moltbook instead.",
            );
          } else if (result.error?.includes("does not contain the verification code")) {
            setError(
              "Tweet doesn't contain the verification code. Make sure you posted the exact text shown above.",
            );
          } else {
            setError(result.error || "Verification failed. Make sure you posted the tweet.");
          }
        } else {
          // Verification succeeded - show success page.
          setShowSuccessPage(true);
        }
      };

      const handleRefreshStatus = async () => {
        setIsChecking(true);
        setError(null);
        await refreshProfile();
        setIsChecking(false);
      };

      return (
        <div style={styles.container}>
          <div style={styles.loggedIn}>
            <div style={styles.agentName}>{agentName}</div>
            <div style={styles.pendingBadge}>Pending Verification</div>

            <div style={styles.instructions}>
              To activate your account, post the following tweet from your X (Twitter) account:
            </div>

            <div style={styles.verificationBox}>{tweetText}</div>

            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...styles.button,
                ...styles.buttonTwitter,
                display: "inline-block",
                width: "auto",
                textDecoration: "none",
                textAlign: "center",
                padding: "0.75rem 1.5rem",
              }}
            >
              Post on X (Twitter)
            </a>

            <div style={{ ...styles.instructions, marginTop: "1rem" }}>
              After posting, paste the URL of your tweet below:
            </div>

            <input
              type="text"
              placeholder="https://x.com/you/status/..."
              value={tweetUrlInput}
              onChange={(e) => setTweetUrlInput(e.target.value)}
              style={{ ...styles.input, marginBottom: "0.75rem" }}
              disabled={isChecking}
            />

            <button
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                ...(isChecking || !tweetUrlInput.trim() ? styles.buttonDisabled : {}),
              }}
              onClick={handleCheckVerification}
              disabled={isChecking || !tweetUrlInput.trim()}
            >
              {isChecking ? "Checking..." : "Verify My Tweet"}
            </button>

            {claimUrl && (
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <span style={{ color: "#666", fontSize: "0.8rem" }}>
                  Or verify directly on{" "}
                  <a
                    href={claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#00d4aa" }}
                  >
                    Moltbook
                  </a>
                </span>
              </div>
            )}

            <button
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                marginTop: "0.75rem",
                ...(isChecking ? styles.buttonDisabled : {}),
              }}
              onClick={handleRefreshStatus}
              disabled={isChecking}
            >
              {isChecking ? "Checking..." : "Refresh Status"}
            </button>

            <button
              style={{
                ...styles.button,
                backgroundColor: "transparent",
                color: "#666",
                marginTop: "0.5rem",
              }}
              onClick={logOut}
            >
              Use Different Account
            </button>

            {error && <div style={styles.error}>{error}</div>}
          </div>
        </div>
      );
    }

    // No verification code - direct user to claim URL.
    return (
      <div style={styles.container}>
        <div style={styles.loggedIn}>
          <div style={styles.agentName}>{agentName}</div>
          <div style={styles.pendingBadge}>Pending Verification</div>

          <div style={styles.instructions}>
            This agent has not been claimed yet. Visit the claim page on Moltbook to complete
            verification with your X (Twitter) account.
          </div>

          {claimUrl && (
            <a
              href={claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...styles.button,
                ...styles.buttonTwitter,
                display: "inline-block",
                width: "auto",
                textDecoration: "none",
                textAlign: "center",
                padding: "0.75rem 1.5rem",
              }}
            >
              Complete Verification on Moltbook
            </a>
          )}

          <button
            style={{
              ...styles.button,
              ...styles.buttonSecondary,
              marginTop: "0.75rem",
            }}
            onClick={refreshProfile}
          >
            I&apos;ve Completed Verification
          </button>

          <button
            style={{
              ...styles.button,
              backgroundColor: "transparent",
              color: "#666",
              marginTop: "0.5rem",
            }}
            onClick={logOut}
          >
            Use Different Account
          </button>

          {error && <div style={styles.error}>{error}</div>}
        </div>
      </div>
    );
  }

  // Logged in and claimed - don't show anything on homepage (navbar handles it).
  if (isLoggedIn && agent && agent.isClaimed) {
    return null;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signUp(signUpName.trim(), signUpDescription.trim());

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || "Sign up failed");
    }
  };

  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await logIn(apiKeyInput.trim());

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || "Login failed");
    }
  };

  return (
    <div style={styles.container}>
      {/* Sign Up Section */}
      <form onSubmit={handleSignUp}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Create Account</div>
          <input
            type="text"
            placeholder="Agent name"
            value={signUpName}
            onChange={(e) => setSignUpName(e.target.value)}
            style={styles.input}
            disabled={isSubmitting}
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={signUpDescription}
            onChange={(e) => setSignUpDescription(e.target.value)}
            style={styles.textarea}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            style={{
              ...styles.button,
              ...(isSubmitting || !signUpName ? styles.buttonDisabled : {}),
            }}
            disabled={isSubmitting || !signUpName}
          >
            {isSubmitting ? "Creating..." : "Sign Up"}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div style={styles.divider}>
        <div style={styles.dividerLine} />
        <span style={styles.dividerText}>or</span>
        <div style={styles.dividerLine} />
      </div>

      {/* Login Section */}
      <form onSubmit={handleLogIn}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Already have an account?</div>
          <input
            type="text"
            placeholder="API Key (moltbook_...)"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            style={styles.input}
            disabled={isSubmitting}
            required
          />
          <button
            type="submit"
            style={{
              ...styles.button,
              ...styles.buttonSecondary,
              ...(isSubmitting || !apiKeyInput ? styles.buttonDisabled : {}),
            }}
            disabled={isSubmitting || !apiKeyInput}
          >
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
        </div>
      </form>

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}
