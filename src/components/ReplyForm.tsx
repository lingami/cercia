// Inline reply form component for replying to comments on Moltbook posts.

import { useState } from "react";
import { createReply } from "../api/comments";
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
    padding: "0.75rem 1rem",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    borderRadius: "6px",
    border: "1px solid #333",
    fontFamily,
    boxSizing: "border-box" as const,
  },
  label: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.7rem",
    color: "#ccc",
    marginBottom: "0.2rem",
  },
  charCount: {
    color: "#666",
    fontWeight: 400,
  },
  textarea: {
    width: "100%",
    padding: "0.5rem 0.6rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.8rem",
    marginBottom: "0.5rem",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "60px",
    fontFamily,
    boxSizing: "border-box" as const,
  },
  error: {
    color: "#e01b24",
    fontSize: "0.75rem",
    marginBottom: "0.5rem",
  },
  hint: {
    color: "#888",
    fontSize: "0.7rem",
    marginTop: "-0.3rem",
    marginBottom: "0.5rem",
  },
  buttons: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  submitButton: {
    padding: "0.35rem 1rem",
    backgroundColor: "#e01b24",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
    fontFamily,
  },
  cancelButton: {
    padding: "0.35rem 1rem",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily,
  },
  disabled: {
    backgroundColor: "#666",
    cursor: "not-allowed",
  },
};

interface ReplyFormProps {
  postId: string;
  parentId: string;
  onSuccess: (commentId: string, content: string) => void;
  onCancel: () => void;
}

export function ReplyForm({ postId, parentId, onSuccess, onCancel }: ReplyFormProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHintText(null);

    if (!content.trim()) {
      setError("Reply content is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const stored = await browser.storage.local.get(AUTH_STORAGE_KEY);
      const data = stored[AUTH_STORAGE_KEY] as { apiKey?: string } | undefined;
      const apiKey = data?.apiKey;

      if (!apiKey) {
        setError("You must be logged in to reply.");
        setIsSubmitting(false);
        return;
      }

      const result = await createReply(apiKey, postId, content.trim(), parentId);

      if (result.success && result.data) {
        await addCreatedComment({
          id: result.data.id,
          postId,
          parentId,
          content: content.trim(),
          createdAt: new Date().toISOString(),
        });
        // Auto-upvote the new reply and persist the vote state locally.
        upvoteComment(apiKey, result.data.id).catch(() => {});
        setVote("comment", result.data.id, "up").catch(() => {});
        onSuccess(result.data.id, content.trim());
      } else {
        setError(result.error || "Failed to post reply.");
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
      <form onSubmit={handleSubmit}>
        <div style={styles.label}>
          <span>Reply</span>
          <span style={styles.charCount}>
            {content.length}/{CONTENT_MAX}
          </span>
        </div>
        <textarea
          placeholder="Write a reply..."
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
          style={styles.textarea}
          disabled={isSubmitting}
          maxLength={CONTENT_MAX}
          autoFocus
        />

        {error && <div style={styles.error}>{error}</div>}
        {hintText && <div style={styles.hint}>{hintText}</div>}

        <div style={styles.buttons}>
          <button
            type="submit"
            style={{ ...styles.submitButton, ...(!canSubmit ? styles.disabled : {}) }}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Replying..." : "Reply"}
          </button>
          <button type="button" style={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
