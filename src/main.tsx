import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Game from "./pages/Game.tsx";
import { initAnalytics } from "./lib/analytics.ts";
import {
  flushPending,
  handleAuthCallback,
  restoreHistoryIfLinked,
} from "./lib/backend.ts";

initAnalytics();

// Returning from an account magic link: the URL hash carries the session
// tokens, and supabase-js can only pick them up if the client exists during
// load — so this one path initializes it eagerly.
if (window.location.hash.includes("access_token")) {
  void handleAuthCallback();
}

// Retry any score submissions queued while offline (e.g. airplane-mode play
// yesterday), then pull down any scores a linked account earned on another
// device — off the critical path, once the app has settled.
const idle =
  "requestIdleCallback" in window
    ? window.requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 2000);
idle(() => void flushPending().then(restoreHistoryIfLinked));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Game />
  </StrictMode>,
);
