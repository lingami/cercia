// Form component for creating new submolts (communities) on Moltbook.

import { useState } from "react";
import { createSubmolt, CreateSubmoltRequest } from "../api/client";

const STORAGE_KEY = "cercia_auth";

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const styles = {
  card: {
    width: "100%",
    maxWidth: "700px",
    margin: "2rem auto 0",
    padding: "1.5rem",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    borderRadius: "12px",
    border: "1px solid #333",
    fontFamily,
  },
  columns: {
    display: "flex",
    gap: "1.5rem",
  },
  left: {
    flex: "0 0 60%",
  },
  right: {
    flex: "0 0 calc(40% - 1.5rem)",
  },
  sectionTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#888",
    marginBottom: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  label: {
    display: "block",
    fontSize: "0.8rem",
    color: "#ccc",
    marginBottom: "0.25rem",
  },
  input: {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
    marginBottom: "0.75rem",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  namePrefix: {
    padding: "0.75rem 0 0.75rem 1rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRight: "none",
    borderRadius: "8px 0 0 8px",
    color: "#e01b24",
    fontSize: "0.9rem",
    fontWeight: 600,
    fontFamily,
  },
  nameInput: {
    flex: 1,
    padding: "0.75rem 1rem 0.75rem 0.25rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderLeft: "none",
    borderRadius: "0 8px 8px 0",
    color: "#fff",
    fontSize: "0.9rem",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily,
  },
  textarea: {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
    marginBottom: "0.75rem",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "80px",
    fontFamily,
    boxSizing: "border-box" as const,
  },
  error: {
    color: "#e01b24",
    fontSize: "0.8rem",
    marginBottom: "0.75rem",
  },
  buttons: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  submitButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#e01b24",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
    fontFamily,
  },
  cancelButton: {
    padding: "0.75rem 1rem",
    backgroundColor: "transparent",
    border: "none",
    color: "#888",
    fontSize: "0.9rem",
    cursor: "pointer",
    fontFamily,
  },
  disabled: {
    backgroundColor: "#666",
    cursor: "not-allowed",
  },
  // Preview card styles.
  preview: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "1rem",
  },
  previewHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.5rem",
  },
  previewAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#333",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "1.1rem",
    fontWeight: 600,
    flexShrink: 0,
    fontFamily,
  },
  previewName: {
    color: "#e01b24",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  previewDisplayName: {
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
  },
  previewDescription: {
    color: "#888",
    fontSize: "0.85rem",
    lineHeight: 1.4,
    marginBottom: "0.5rem",
  },
  previewMembers: {
    color: "#666",
    fontSize: "0.8rem",
  },
  // Inline toggle button.
  toggleButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "transparent",
    border: "1px solid #00d4aa",
    borderRadius: "8px",
    color: "#00d4aa",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
    fontFamily,
  },
};

// Valid name pattern: lowercase letters, numbers, hyphens, underscores.
const NAME_PATTERN = /^[a-z0-9_-]*$/;

// Convert a raw name to a display name by capitalizing words.
function nameToDisplayName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface CreateSubmoltFormProps {
  onSuccess?: (name: string) => void;
  onCancel?: () => void;
}

export function CreateSubmoltForm({ onSuccess, onCancel }: CreateSubmoltFormProps) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = (value: string) => {
    // Only allow valid characters.
    const cleaned = value.toLowerCase().slice(0, 50);
    if (!NAME_PATTERN.test(cleaned)) return;
    setName(cleaned);
    // Auto-populate display name unless the user has manually edited it.
    if (!displayNameEdited) {
      setDisplayName(nameToDisplayName(cleaned));
    }
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setDisplayNameEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!NAME_PATTERN.test(name)) {
      setError("Name can only contain lowercase letters, numbers, hyphens, and underscores.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Read the API key from extension storage.
      const stored = await browser.storage.local.get(STORAGE_KEY);
      const data = stored[STORAGE_KEY] as { apiKey?: string } | undefined;
      const apiKey = data?.apiKey;

      if (!apiKey) {
        setError("You must be logged in to create a community.");
        setIsSubmitting(false);
        return;
      }

      const request: CreateSubmoltRequest = {
        name: name.trim(),
        display_name: displayName.trim() || nameToDisplayName(name.trim()),
        description: description.trim(),
      };

      const result = await createSubmolt(apiKey, request);

      if (result.success) {
        onSuccess?.(name.trim());
      } else {
        setError(result.error || "Failed to create community.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewLetter = name ? name[0].toUpperCase() : "?";
  const previewName = name || "...";
  const previewDisplayName = displayName || nameToDisplayName(name) || "Community Name";
  const previewDescription = description || "No description yet";

  return (
    <div style={styles.card}>
      <div style={styles.sectionTitle}>Create a Community</div>
      <div style={styles.columns}>
        <form style={styles.left} onSubmit={handleSubmit}>
          <label style={styles.label}>Name</label>
          <div style={styles.nameRow}>
            <span style={styles.namePrefix}>m/</span>
            <input
              type="text"
              placeholder="community-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              style={styles.nameInput}
              disabled={isSubmitting}
              maxLength={50}
            />
          </div>

          <label style={styles.label}>Display Name</label>
          <input
            type="text"
            placeholder="Community Name"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            style={styles.input}
            disabled={isSubmitting}
          />

          <label style={styles.label}>Description</label>
          <textarea
            placeholder="What is this community about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            disabled={isSubmitting}
          />

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.buttons}>
            <button
              type="submit"
              style={{
                ...styles.submitButton,
                ...(isSubmitting || !name.trim() ? styles.disabled : {}),
              }}
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? "Creating..." : "Create Community"}
            </button>
            {onCancel && (
              <button type="button" style={styles.cancelButton} onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div style={styles.right}>
          <label style={{ ...styles.label, marginBottom: "0.5rem" }}>Preview</label>
          <div style={styles.preview}>
            <div style={styles.previewHeader}>
              <div style={styles.previewAvatar}>{previewLetter}</div>
              <div>
                <div style={styles.previewName}>m/{previewName}</div>
              </div>
            </div>
            <div style={styles.previewDisplayName}>{previewDisplayName}</div>
            <div style={styles.previewDescription}>{previewDescription}</div>
            <div style={styles.previewMembers}>0 members</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CreateSubmoltInlineProps {
  defaultOpen?: boolean;
}

export function CreateSubmoltInline({ defaultOpen = false }: CreateSubmoltInlineProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleSuccess = (name: string) => {
    const target = window.top ?? window;
    target.location.assign(`/m/${name}`);
  };

  if (!isOpen) {
    return (
      <button style={styles.toggleButton} onClick={() => setIsOpen(true)}>
        Create Community
      </button>
    );
  }

  return <CreateSubmoltForm onSuccess={handleSuccess} onCancel={() => setIsOpen(false)} />;
}
