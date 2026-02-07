// Form component for creating posts on Moltbook submolts.

import { useState } from "react";
import { createPost, upvotePost } from "../api/client";
import { addCreatedPost } from "../storage/posts";
import { setVote } from "../storage/votes";

const STORAGE_KEY = "cercia_auth";
const TITLE_MAX = 300;
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
  typeToggle: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  typePill: {
    padding: "0.4rem 1rem",
    border: "1px solid #444",
    borderRadius: "20px",
    backgroundColor: "transparent",
    color: "#888",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily,
  },
  typePillActive: {
    backgroundColor: "#00d4aa",
    borderColor: "#00d4aa",
    color: "#000",
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
  input: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    marginBottom: "0.6rem",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily,
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

type PostType = "text" | "link";

interface CreatePostFormProps {
  submoltName: string;
  onSuccess?: (postId: string) => void;
}

export function CreatePostForm({ submoltName, onSuccess }: CreatePostFormProps) {
  const [postType, setPostType] = useState<PostType>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHintText(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (title.length > TITLE_MAX) {
      setError(`Title must be ${TITLE_MAX} characters or fewer.`);
      return;
    }
    if (postType === "text" && !content.trim()) {
      setError("Post content is required.");
      return;
    }
    if (postType === "link" && !url.trim()) {
      setError("URL is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const stored = await browser.storage.local.get(STORAGE_KEY);
      const data = stored[STORAGE_KEY] as { apiKey?: string } | undefined;
      const apiKey = data?.apiKey;

      if (!apiKey) {
        setError("You must be logged in to create a post.");
        setIsSubmitting(false);
        return;
      }

      const result = await createPost(apiKey, {
        submolt: submoltName,
        title: title.trim(),
        ...(postType === "text" ? { content: content.trim() } : { url: url.trim() }),
      });

      if (result.success && result.data?.post) {
        const post = result.data.post;
        await addCreatedPost({
          id: post.id,
          title: post.title,
          submolt: post.submolt.name,
          createdAt: new Date().toISOString(),
        });
        // Auto-upvote the new post and persist the vote state locally.
        // Await `setVote` since `onSuccess` navigates to the post page.
        upvotePost(apiKey, post.id).catch(() => {});
        await setVote("post", post.id, "up");
        onSuccess?.(post.id);
      } else {
        setError(result.error || "Failed to create post.");
        if (result.hint) setHintText(result.hint);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    title.trim() && (postType === "text" ? content.trim() : url.trim()) && !isSubmitting;

  return (
    <div style={styles.card}>
      <div style={styles.header}>Create a post in m/{submoltName}</div>

      <div style={styles.typeToggle}>
        <button
          type="button"
          style={{ ...styles.typePill, ...(postType === "text" ? styles.typePillActive : {}) }}
          onClick={() => setPostType("text")}
        >
          Text
        </button>
        <button
          type="button"
          style={{ ...styles.typePill, ...(postType === "link" ? styles.typePillActive : {}) }}
          onClick={() => setPostType("link")}
        >
          Link
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={styles.label}>
          <span>Title</span>
          <span style={styles.charCount}>
            {title.length}/{TITLE_MAX}
          </span>
        </div>
        <input
          type="text"
          placeholder="An interesting title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          style={styles.input}
          disabled={isSubmitting}
          maxLength={TITLE_MAX}
        />

        {postType === "text" ? (
          <>
            <div style={styles.label}>
              <span>Content</span>
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
          </>
        ) : (
          <>
            <div style={styles.label}>
              <span>URL</span>
            </div>
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={styles.input}
              disabled={isSubmitting}
            />
          </>
        )}

        {error && <div style={styles.error}>{error}</div>}
        {hintText && <div style={styles.hint}>{hintText}</div>}

        <div style={styles.buttons}>
          <button
            type="submit"
            style={{ ...styles.submitButton, ...(!canSubmit ? styles.disabled : {}) }}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
