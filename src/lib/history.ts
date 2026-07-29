import { CONTINENTS, type Continent } from "./cities.ts";
import type { GameMode } from "./gameMode.ts";

// Append-only per-mode game history, one entry per local date. Separate from
// the self-expiring bearing:lastResult:* keys — this store accumulates
// forever (365 entries/year is a few KB).
const keyFor = (mode: GameMode) => `bearing:history:${mode}`;

export interface HistoryEntry {
  dateKey: string; // local YYYY-MM-DD, from todayKey()
  score: number; // scoreOf(results), 0–900
  errors: number[]; // 5 per-city errors, rounded to 0.1
  // Which continent's puzzle this was (continental mode only). Stays in
  // localStorage like the rounded position in storage.ts does.
  continent?: Continent;
}

const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isContinent = (v: unknown): v is Continent =>
  typeof v === "string" && (CONTINENTS as readonly string[]).includes(v);

// localStorage is untrusted input — validate each entry field-by-field and
// drop the malformed ones rather than discarding the whole history.
function parseEntry(data: unknown): HistoryEntry | null {
  if (typeof data !== "object" || data === null) return null;
  const { dateKey, score, errors, continent } = data as Record<string, unknown>;
  if (!isDateKey(dateKey)) return null;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (
    !Array.isArray(errors) ||
    errors.length !== 5 ||
    !errors.every((e) => typeof e === "number" && Number.isFinite(e))
  ) {
    return null;
  }
  const entry: HistoryEntry = { dateKey, score, errors: errors as number[] };
  if (isContinent(continent)) entry.continent = continent;
  return entry;
}

export function loadHistory(mode: GameMode): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(mode));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map(parseEntry)
      .filter((e): e is HistoryEntry => e !== null)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  } catch {
    return [];
  }
}

// Upsert by dateKey — replaying a saved day (reload, mode switch) never
// duplicates an entry.
export function recordGame(mode: GameMode, entry: HistoryEntry): void {
  try {
    const rest = loadHistory(mode).filter((e) => e.dateKey !== entry.dateKey);
    const next = [...rest, entry].sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    );
    localStorage.setItem(keyFor(mode), JSON.stringify(next));
  } catch {
    // storage full or unavailable (private mode) — losing history is fine
  }
}
