import { gradeEmoji } from "./directions.ts";
import type { HistoryEntry } from "./history.ts";
import { dayNumber } from "./today.ts";

// Derived stats over history entries. Pure — no storage access.

// One bucket per grade tier, applied to the average per-city error
// (score / 5): 🎯 ≤50 total, 🟢 ≤125, 🟡 ≤300, 🟠 ≤550, 🔴 else.
export const GRADE_TIERS = ["🎯", "🟢", "🟡", "🟠", "🔴"] as const;

export interface ModeStats {
  gamesPlayed: number;
  averageScore: number | null; // null when gamesPlayed === 0
  bestScore: number | null;
  distribution: number[]; // 5 counts, one per GRADE_TIERS entry
}

export function computeModeStats(entries: HistoryEntry[]): ModeStats {
  const distribution = GRADE_TIERS.map(() => 0);
  let sum = 0;
  let best: number | null = null;
  for (const e of entries) {
    sum += e.score;
    if (best === null || e.score < best) best = e.score;
    const tier = GRADE_TIERS.indexOf(
      gradeEmoji(e.score / 5) as (typeof GRADE_TIERS)[number],
    );
    distribution[tier === -1 ? GRADE_TIERS.length - 1 : tier]++;
  }
  return {
    gamesPlayed: entries.length,
    averageScore: entries.length ? Math.round(sum / entries.length) : null,
    bestScore: best,
    distribution,
  };
}

// Streaks over the set of played local dates (pass the union across modes —
// playing either mode keeps the streak alive).
//
// `current` is the run ending today or yesterday: Wordle-style grace, the
// streak stays alive before you've played today and only reads 0 once a
// full local day has been missed.
export function computeStreaks(
  dateKeys: string[],
  today: string,
): { current: number; max: number } {
  const days = [...new Set(dateKeys.map(dayNumber))].sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, max: 0 };

  let max = 0;
  let run = 0;
  let prev: number | null = null;
  const runEnding = new Map<number, number>(); // day -> length of run ending there
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    runEnding.set(d, run);
    if (run > max) max = run;
    prev = d;
  }

  const todayNum = dayNumber(today);
  const current = runEnding.get(todayNum) ?? runEnding.get(todayNum - 1) ?? 0;
  return { current, max };
}
