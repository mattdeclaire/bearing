// Umami Cloud analytics — cookieless, no PII. Set WEBSITE_ID to the site's
// Umami website ID to enable; empty string keeps analytics fully inert.
// Privacy rule: never send coordinates, headings, or anything derived from
// the player's location — scores, modes, and statuses only.
const WEBSITE_ID = "04fa0e6c-977c-4688-8e5a-3a7c8cf3acd1";

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

export function initAnalytics(): void {
  if (!WEBSITE_ID) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.setAttribute("data-website-id", WEBSITE_ID);
  document.head.appendChild(s);
}

export function track(
  event: string,
  data?: Record<string, string | number>,
): void {
  window.umami?.track(event, data);
}
