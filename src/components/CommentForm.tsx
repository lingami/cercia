// Form component for creating top-level comments on Moltbook posts.

import { useState } from "react";
import { createComment } from "../api/comments";
import { upvoteComment } from "../api/client";
import { addCreatedComment } from "../storage/comments";
import { setVote } from "../storage/votes";

const AUTH_STORAGE_KEY = "cercia_auth";
const CONTENT_MAX = 40000;

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const styles = {
  card: {
    width: "100%",
    padding: "1rem 1.25rem",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    borderRadius: "8px",
    border: "1px solid #333",
    fontFamily,
    boxSizing: "border-box" as const,
  },
  header: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#888",
    marginBottom: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  label: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.75rem",
    color: "#ccc",
    marginBottom: "0.2rem",
  },
  charCount: {
    color: "#666",
    fontWeight: 400,
  },
  textarea: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    marginBottom: "0.6rem",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "80px",
    fontFamily,
    boxSizing: "border-box" as const,
  },
  error: {
    color: "#e01b24",
    fontSize: "0.8rem",
    marginBottom: "0.6rem",
  },
  hint: {
    color: "#888",
    fontSize: "0.75rem",
    marginTop: "-0.4rem",
    marginBottom: "0.6rem",
  },
  buttons: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  submitButton: {
    padding: "0.5rem 1.25rem",
    backgroundColor: "#e01b24",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
    fontFamily,
  },
  disabled: {
    backgroundColor: "#666",
    cursor: "not-allowed",
  },
};

interface CommentFormProps {
  postId: string;
  onSuccess: (commentId: string, content: string) => void;
}

export function CommentForm({ postId, onSuccess }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHintText(null);

    if (!content.trim()) {
      setError("Comment content is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
      const data = stored[AUTH_STORAGE_KEY] as { apiKey?: string } | undefined;
      const apiKey = data?.apiKey;

      if (!apiKey) {
        setError("You must be logged in to comment.");
        setIsSubmitting(false);
        return;
      }

      const result = await createComment(apiKey, postId, content.trim());

      if (result.success && result.data) {
        await addCreatedComment({
          id: result.data.id,
          postId,
          content: content.trim(),
          createdAt: new Date().toISOString(),
        });
        // Auto-upvote the new comment and persist the vote state locally.
        upvoteComment(apiKey, result.data.id).catch(() => {});
        setVote("comment", result.data.id, "up").catch(() => {});
        const submittedContent = content.trim();
        setContent("");
        onSuccess(result.data.id, submittedContent);
      } else {
        setError(result.error || "Failed to create comment.");
        if (result.hint) setHintText(result.hint);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = content.trim() && !isSubmitting;

  return (
    <div style={styles.card}>
      <div style={styles.header}>Add a comment</div>
      <form onSubmit={handleSubmit}>
        <div style={styles.label}>
          <span>Comment</span>
          <span style={styles.charCount}>
            {content.length}/{CONTENT_MAX}
          </span>
        </div>
        <textarea
          placeholder="What are your thoughts?"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
          style={styles.textarea}
          disabled={isSubmitting}
          maxLength={CONTENT_MAX}
        />

        {error && <div style={styles.error}>{error}</div>}
        {hintText && <div style={styles.hint}>{hintText}</div>}

        <div style={styles.buttons}>
          <button
            type="submit"
            style={{ ...styles.submitButton, ...(!canSubmit ? styles.disabled : {}) }}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Commenting..." : "Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
