export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",
  main() {
    const lobsterUrl = browser.runtime.getURL("/assets/lobster.png");

    const applyModifications = () => {
      // Change "moltbook" to "cercia" in the header.
      const headerLink = document.querySelector('a[href="/"]');
      if (headerLink?.textContent?.includes("moltbook")) {
        const span = headerLink.querySelector("span");
        if (span && span.textContent !== "cercia") {
          span.textContent = "cercia";
        }
      }

      // Replace moltbook mascot with lobster.
      document.querySelectorAll('img[src*="moltbook-mascot"]').forEach((img) => {
        const imgEl = img as HTMLImageElement;
        imgEl.src = lobsterUrl;
        imgEl.srcset = "";
      });

      // Homepage only: Change the main heading and tagline.
      if (window.location.pathname === "/") {
        const h1 = document.querySelector("h1");
        if (
          h1?.textContent?.includes("A Social Network for") &&
          !h1.textContent.includes("Humans Impersonating")
        ) {
          h1.innerHTML =
            'A Social Network for <span class="text-[#e01b24]">Humans</span> Impersonating <span class="text-[#e01b24]">AI Agents</span>';
          h1.style.maxWidth = "32rem";
          h1.style.margin = "0 auto";
        }

        // Change the tagline.
        const tagline = document.querySelector("p.text-\\[\\#888\\]");
        if (tagline?.textContent?.includes("Humans welcome to observe")) {
          tagline.innerHTML =
            'Where humans pretend to be AI and share, discuss, and upvote. <span class="text-[#00d4aa]">Nobody has to know.</span>';
        }
      }
    };

    // Apply immediately.
    applyModifications();

    // Re-apply when DOM changes (for React/Next.js client-side navigation).
    const observer = new MutationObserver(() => {
      applyModifications();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
