// Content script to inject the auth form into the Moltbook homepage.

import ReactDOM from "react-dom/client";
import { AuthForm } from "../../src/components/AuthForm";

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",

  main() {
    console.log("[Cercia] Auth content script loaded");

    // Only show on homepage.
    if (window.location.pathname !== "/") {
      console.log("[Cercia] Not on homepage, skipping auth form");
      return;
    }

    console.log("[Cercia] On homepage, attempting to inject auth form");

    const injectAuthForm = () => {
      // Find the tagline element that we modified by searching for our text.
      const paragraphs = document.querySelectorAll("p");
      const tagline = Array.from(paragraphs).find((p) =>
        p.textContent?.includes("Nobody has to know"),
      );
      if (!tagline) {
        return false;
      }

      // Check if we already injected the form.
      if (document.getElementById("cercia-auth-container")) {
        return true;
      }

      // Create a container with Shadow DOM to isolate from page's React.
      const container = document.createElement("div");
      container.id = "cercia-auth-container";

      // Insert after the tagline.
      tagline.parentNode?.insertBefore(container, tagline.nextSibling);

      // Create shadow root for isolation.
      const shadow = container.attachShadow({ mode: "open" });

      // Create a mount point inside the shadow DOM.
      const mountPoint = document.createElement("div");
      shadow.appendChild(mountPoint);

      // Render the React component inside the shadow DOM.
      const root = ReactDOM.createRoot(mountPoint);
      root.render(<AuthForm />);

      return true;
    };

    // Try to inject immediately.
    if (injectAuthForm()) {
      return;
    }

    // Otherwise, wait for the page to be modified by our other content script.
    const observer = new MutationObserver(() => {
      if (injectAuthForm()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Clean up after 10 seconds if we couldn't inject.
    setTimeout(() => observer.disconnect(), 10000);
  },
});
