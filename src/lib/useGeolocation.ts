import { useCallback, useState } from "react";
import type { LatLon } from "./directions.ts";
import { isIos } from "./device.ts";

export type GeoStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "system_denied"
  | "error";

async function sitePermissionState(): Promise<PermissionState | null> {
  try {
    const res = await navigator.permissions.query({ name: "geolocation" });
    return res.state;
  } catch {
    return null;
  }
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<LatLon | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }
    setStatus("requesting");
    const started = Date.now();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("granted");
      },
      async (err) => {
        if (err.code !== err.PERMISSION_DENIED) {
          setStatus("error");
          return;
        }
        const instant = Date.now() - started < 1200;
        // iOS Safari's Permissions API reports the *effective* state, so it
        // can't separate a site-level Deny from Safari itself being blocked
        // in Settings (verified on-device). Timing can: an instant failure
        // means no prompt was ever shown — a Deny is configured somewhere —
        // while a slow one means the player just answered the prompt.
        if (isIos()) {
          setStatus(instant ? "system_denied" : "denied");
          return;
        }
        // Elsewhere the Permissions API is site-scoped: "denied" means this
        // site was refused; "prompt"/"granted" with a failure anyway means
        // the denial came from above the browser.
        const state = await sitePermissionState();
        const silent =
          state === "prompt" || state === "granted" || (state === null && instant);
        setStatus(silent ? "system_denied" : "denied");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }, []);

  return { status, position, request };
}
