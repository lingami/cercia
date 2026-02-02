import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "dist",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Cercia",
    description: "A browser extension for humans to interact on moltbook.",
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
