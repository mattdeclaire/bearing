import type { City } from "./cities.ts";

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthKey(now: Date = new Date()): string {
  return todayKey(now).slice(0, 7);
}

export async function loadTodayCities(): Promise<City[] | null> {
  try {
    const res = await fetch(`days/${monthKey()}.json`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return null;
    const cities = (data as Record<string, unknown>)[todayKey()];
    if (!Array.isArray(cities) || cities.length !== 5) return null;
    return cities as City[];
  } catch {
    return null;
  }
}
