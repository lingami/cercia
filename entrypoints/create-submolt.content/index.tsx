// Content script to inject the create submolt form on the communities page.

import ReactDOM from "react-dom/client";
import { CreateSubmoltInline } from "../../src/components/CreateSubmoltForm";
import { onNavigate } from "../../src/navigation";

const STORAGE_KEY = "cercia_auth";

async function injectCreateButton(autoOpen: boolean): Promise<boolean> {
  // Auth gate: only show if the user is logged in.
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const data = stored[STORAGE_KEY] as { apiKey?: string } | undefined;
  if (!data?.apiKey) {
    return false;
  }

  // Find the header area containing the "Communities" h1.
  const headings = document.querySelectorAll("h1");
  const communitiesH1 = Array.from(headings).find(
    (h) => h.textContent?.trim().toLowerCase() === "communities",
  );
  if (!communitiesH1) {
    return false;
  }

  // Check if we already injected.
  if (document.getElementById("cercia-create-submolt")) {
    return true;
  }

  // Find the parent div of the h1 to insert after it.
  const headerDiv = communitiesH1.closest("div");
  if (!headerDiv) {
    return false;
  }

  // Create a container with shadow DOM isolation.
  const container = document.createElement("div");
  container.id = "cercia-create-submolt";
  container.style.marginTop = "-0.5rem";
  container.style.marginBottom = "1rem";

  // Insert after the header div.
  headerDiv.parentNode?.insertBefore(container, headerDiv.nextSibling);

  // Create shadow root for isolation.
  const shadow = container.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  // Render the React component inside the shadow DOM.
  const root = ReactDOM.createRoot(mountPoint);
  root.render(<CreateSubmoltInline defaultOpen={autoOpen} />);

  return true;
}

function tryInjectOnCommunitiesPage() {
  // Only inject on the communities listing page.
  if (window.location.pathname !== "/m") {
    return;
  }

  // Check if the URL has ?create=1 to auto-open the form.
  const params = new URLSearchParams(window.location.search);
  const autoOpen = params.get("create") === "1";

  // Try to inject immediately.
  injectCreateButton(autoOpen).then((injected) => {
    if (injected) return;

    // Otherwise, wait for the DOM to be ready.
    const observer = new MutationObserver(() => {
      injectCreateButton(autoOpen).then((success) => {
        if (success) observer.disconnect();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Clean up after 10 seconds if we couldn't inject.
    setTimeout(() => observer.disconnect(), 10000);
  });
}

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",

  main() {
    console.log("[Cercia] Create submolt content script loaded");

    // Try on initial page load.
    tryInjectOnCommunitiesPage();

    // Re-try on SPA navigation.
    onNavigate(() => {
      tryInjectOnCommunitiesPage();
    });
  },
});
