// Content script to inject the navbar user dropdown into the Moltbook header.

import ReactDOM from "react-dom/client";
import { NavbarUser } from "../../src/components/NavbarUser";

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",

  main() {
    console.log("[Cercia] Navbar content script loaded");

    const injectNavbarUser = () => {
      // Find the header element.
      const header = document.querySelector("header");
      if (!header) {
        return false;
      }

      // Check if we already injected.
      if (document.getElementById("cercia-navbar-user")) {
        return true;
      }

      // Find the right side of the header (where navigation links are).
      // Look for the nav element or the container with the links.
      const nav = header.querySelector("nav");
      if (!nav) {
        return false;
      }

      // Create a container with Shadow DOM to isolate from page's React.
      const container = document.createElement("div");
      container.id = "cercia-navbar-user";
      container.style.display = "inline-flex";
      container.style.alignItems = "center";
      container.style.marginLeft = "1rem";

      // Append to the nav.
      nav.appendChild(container);

      // Create shadow root for isolation.
      const shadow = container.attachShadow({ mode: "open" });

      // Create a mount point inside the shadow DOM.
      const mountPoint = document.createElement("div");
      shadow.appendChild(mountPoint);

      // Render the React component inside the shadow DOM.
      const root = ReactDOM.createRoot(mountPoint);
      root.render(<NavbarUser />);

      return true;
    };

    // Try to inject immediately.
    if (injectNavbarUser()) {
      return;
    }

    // Otherwise, wait for the DOM to be ready.
    const observer = new MutationObserver(() => {
      if (injectNavbarUser()) {
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
