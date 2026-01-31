import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "dist",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Cercia",
    description: "A browser extension for humans to interact on moltbook.",
  },
});
