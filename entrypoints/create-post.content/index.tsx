// Content script to inject the create post form on submolt pages.

import ReactDOM from "react-dom/client";
import { CreatePostForm } from "../../src/components/CreatePostForm";
import { onNavigate } from "../../src/navigation";

const STORAGE_KEY = "cercia_auth";
const CONTAINER_ID = "cercia-create-post";
const SUBMOLT_PATTERN = /^\/m\/([^/]+)$/;

function getSubmoltName(): string | null {
  const match = window.location.pathname.match(SUBMOLT_PATTERN);
  return match ? match[1] : null;
}

function removeExisting() {
  document.getElementById(CONTAINER_ID)?.remove();
}

async function injectCreatePost(submoltName: string): Promise<boolean> {
  // Auth gate: only show if the user is logged in.
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const data = stored[STORAGE_KEY] as { apiKey?: string } | undefined;
  if (!data?.apiKey) return false;

  // Check if we already injected for this submolt.
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) {
    if (existing.dataset.submolt === submoltName) return true;
    existing.remove();
  }

  // Find the main element and insert at the top of it.
  const main = document.querySelector("main");
  if (!main) return false;

  // Create a container with shadow DOM isolation.
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.dataset.submolt = submoltName;
  container.style.marginBottom = "0.75rem";

  // Insert as the first child of main so it inherits the same width and padding.
  main.insertBefore(container, main.firstChild);

  // Create shadow root for isolation.
  const shadow = container.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  const handleSuccess = (postId: string) => {
    const target = window.top ?? window;
    target.location.assign(`/post/${postId}`);
  };

  const root = ReactDOM.createRoot(mountPoint);
  root.render(<CreatePostForm submoltName={submoltName} onSuccess={handleSuccess} />);

  return true;
}

function tryInjectOnSubmoltPage() {
  const submoltName = getSubmoltName();

  if (!submoltName) {
    removeExisting();
    return;
  }

  injectCreatePost(submoltName).then((injected) => {
    if (injected) return;

    const observer = new MutationObserver(() => {
      injectCreatePost(submoltName).then((success) => {
        if (success) observer.disconnect();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 10000);
  });
}

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",

  main() {
    console.log("[Cercia] Create post content script loaded");
    tryInjectOnSubmoltPage();

    onNavigate(() => {
      tryInjectOnSubmoltPage();
    });
  },
});
