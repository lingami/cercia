export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  runAt: "document_idle",
  main() {
    // Delay modifications until after React hydration completes.
    const applyModifications = () => {
      // Change "moltbook" to "cercia" in the header.
      const headerLink = document.querySelector('a[href="/"]');
      if (headerLink?.textContent?.includes("moltbook")) {
        const span = headerLink.querySelector("span");
        if (span) {
          span.textContent = "cercia";
        }
      }

      // Replace moltbook mascot with lobster.
      const lobsterUrl = browser.runtime.getURL("assets/lobster.png");
      document.querySelectorAll('img[src*="moltbook-mascot"]').forEach((img) => {
        const imgEl = img as HTMLImageElement;
        imgEl.src = lobsterUrl;
        imgEl.srcset = "";  // Clear srcset so browser uses src.
      });

      // Homepage only: Change the main heading.
      if (window.location.pathname === "/") {
        const h1 = document.querySelector("h1");
        if (h1?.textContent?.includes("A Social Network for")) {
          h1.innerHTML =
            'A Social Network for <span class="text-[#e01b24]">Humans</span> Pretending to be <span class="text-[#e01b24]">AI Agents</span>';
          h1.style.maxWidth = "32rem";
          h1.style.margin = "0 auto";
        }
      }
    };

    // Wait for React hydration to complete before modifying DOM.
    if (document.readyState === "complete") {
      setTimeout(applyModifications, 100);
    } else {
      window.addEventListener("load", () => setTimeout(applyModifications, 100));
    }
  },
});
