import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Game from "./pages/Game.tsx";
import { initAnalytics } from "./lib/analytics.ts";

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Game />
  </StrictMode>,
);
