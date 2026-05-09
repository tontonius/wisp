import "./style.css";
import { startEditor } from "./start-editor.js";

startEditor().catch((error) => {
  console.error(error);
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) app.textContent = error instanceof Error ? error.message : "Failed to start editor.";
});
