import type { City } from "./cities.ts";

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function loadTodayCities(): Promise<City[] | null> {
  try {
    const res = await fetch(`days/${todayKey()}.json`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length !== 5) return null;
    return data as City[];
  } catch {
    return null;
  }
}
