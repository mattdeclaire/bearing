import type { CityResult } from "./directions.ts";

const KEY = "bearing:lastResult";

export function saveResult(dateKey: string, results: CityResult[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ dateKey, results }));
  } catch {
    // storage full or unavailable (private mode) — losing persistence is fine
  }
}

export function loadResult(dateKey: string): CityResult[] | null {
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
    return results as CityResult[];
  } catch {
    return null;
  }
}
