import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Game from "./pages/Game.tsx";
import { initAnalytics } from "./lib/analytics.ts";
import { flushPending } from "./lib/backend.ts";

initAnalytics();

// Retry any score submissions queued while offline (e.g. airplane-mode play
// yesterday) — off the critical path, once the app has settled.
const idle =
  "requestIdleCallback" in window
    ? window.requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 2000);
idle(() => void flushPending());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Game />
  </StrictMode>,
);
