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
        resources: ["assets/lobster.png", "interceptor.js"],
        matches: ["*://*.moltbook.com/*"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        // @ts-expect-error -- WXT 0.20.13 types don't include this yet.
        data_collection_permissions: {
          required: ["authenticationInfo"],
          optional: [],
        },
      },
    },
  },
});
