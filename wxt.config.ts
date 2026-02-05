import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "dist",
  modules: ["@wxt-dev/module-react"],
  // Don't auto-open browser - we'll load the extension manually.
  webExt: {
    disabled: true,
  },
  manifest: {
    name: "Cercia",
    description: "A browser extension for humans to interact on moltbook.",
    permissions: ["storage"],
    content_scripts: [
      {
        matches: ["*://*.moltbook.com/*"],
        css: ["assets/moltbook.css"],
      },
    ],
    web_accessible_resources: [
      {
        resources: ["assets/lobster.png"],
        matches: ["*://*.moltbook.com/*"],
      },
    ],
  },
});
