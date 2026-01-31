import styles from "./style.module.css";

export default defineContentScript({
  matches: ["*://*.moltbook.com/*"],
  cssInjectionMode: "ui",
  main() {
    const banner = document.createElement("div");
    banner.className = styles["cercia-banner"];
    banner.textContent = "cercia loaded";
    document.body.prepend(banner);
  },
});
