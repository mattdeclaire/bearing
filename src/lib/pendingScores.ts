import { CONTINENTS, type Continent } from "./cities.ts";
import type { GameMode } from "./gameMode.ts";
import { dayNumber } from "./today.ts";

// The submission queue: finished games waiting to reach Supabase. Lives in
// localStorage so a score survives offline play and gets flushed on the next
// visit. backend.ts owns the network side; everything here is storage and
// pure list manipulation, so it's testable in node.

export interface ScoreSubmission {
  dateKey: string; // local YYYY-MM-DD — the puzzle's identity
  mode: GameMode;
  continent: Continent | null; // null for global mode
  score: number;
  errors: number[]; // 5 per-city errors, whole degrees
  input: "sensor" | "manual";
}

const QUEUE_KEY = "bearing:pendingScores";

// The server's RLS window rejects dates more than a day off — after 2 local
// days a queued score can never be accepted, so stop retrying it.
const MAX_AGE_DAYS = 2;

const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function parseSubmission(data: unknown): ScoreSubmission | null {
  if (typeof data !== "object" || data === null) return null;
  const { dateKey, mode, continent, score, errors, input } = data as Record<
    string,
    unknown
  >;
  if (!isDateKey(dateKey)) return null;
  if (mode !== "continental" && mode !== "global") return null;
  const cont =
    typeof continent === "string" &&
    (CONTINENTS as readonly string[]).includes(continent)
      ? (continent as Continent)
      : null;
  if ((mode === "global") !== (cont === null)) return null;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (
    !Array.isArray(errors) ||
    errors.length !== 5 ||
    !errors.every((e) => typeof e === "number" && Number.isFinite(e))
  ) {
    return null;
  }
  if (input !== "sensor" && input !== "manual") return null;
  return { dateKey, mode, continent: cont, score, errors: errors as number[], input };
}

export function pruneExpired(
  queue: ScoreSubmission[],
  today: string,
): ScoreSubmission[] {
  const todayNum = dayNumber(today);
  return queue.filter((s) => todayNum - dayNumber(s.dateKey) <= MAX_AGE_DAYS);
}

export function loadQueue(): ScoreSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map(parseSubmission)
      .filter((s): s is ScoreSubmission => s !== null);
  } catch {
    return [];
  }
}

export function saveQueue(queue: ScoreSubmission[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // storage full or unavailable — losing a pending submission is fine
  }
}

// Upsert by (dateKey, mode) — the server's primary key. Replaying a day
// can't queue two submissions for the same puzzle.
export function enqueue(queue: ScoreSubmission[], sub: ScoreSubmission): ScoreSubmission[] {
  return [
    ...queue.filter((s) => !(s.dateKey === sub.dateKey && s.mode === sub.mode)),
    sub,
  ];
}
