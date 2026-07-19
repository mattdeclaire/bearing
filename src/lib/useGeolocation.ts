import { useCallback, useState } from "react";
import type { LatLon } from "./directions.ts";

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
        // Distinguish "user denied this site" from the silent failure where
        // the OS never showed a prompt at all (e.g. iOS Location Services set
        // to Never for Safari). After a real site-level denial the
        // Permissions API reports "denied"; if it still says "prompt" (or
        // "granted"), the denial came from above the browser. Where the API
        // is unavailable, an instant failure means no prompt was shown.
        const state = await sitePermissionState();
        const silent =
          state === "prompt" ||
          state === "granted" ||
          (state === null && Date.now() - started < 1200);
        setStatus(silent ? "system_denied" : "denied");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }, []);

  return { status, position, request };
}
