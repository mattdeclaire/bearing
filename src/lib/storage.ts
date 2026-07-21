import type { CityResult, LatLon } from "./directions.ts";

const KEY = "bearing:lastResult";

export interface SavedGame {
  results: CityResult[];
  // Player position rounded to ~11 km, kept only in localStorage so the
  // results globe survives a reload. Null for results saved before the globe
  // existed (the globe is simply hidden then).
  pos: LatLon | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function saveResult(
  dateKey: string,
  results: CityResult[],
  pos: LatLon | null,
): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        dateKey,
        results,
        pos: pos ? { lat: round1(pos.lat), lon: round1(pos.lon) } : null,
      }),
    );
  } catch {
    // storage full or unavailable (private mode) — losing persistence is fine
  }
}

export function loadResult(dateKey: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== "object" ||
      data === null ||
      (data as { dateKey?: unknown }).dateKey !== dateKey
    ) {
      return null;
    }
    const results = (data as { results?: unknown }).results;
    if (!Array.isArray(results) || results.length !== 5) return null;
    const rawPos = (data as { pos?: unknown }).pos;
    const pos =
      typeof rawPos === "object" &&
      rawPos !== null &&
      typeof (rawPos as LatLon).lat === "number" &&
      typeof (rawPos as LatLon).lon === "number"
        ? (rawPos as LatLon)
        : null;
    return { results: results as CityResult[], pos };
  } catch {
    return null;
  }
}
