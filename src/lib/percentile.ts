// Percentile math over a day's score histogram (90 × 10° buckets, fetched
// from daily_distributions). Pure — the fetch lives in backend.ts.

export interface Distribution {
  histogram: number[]; // 90 counts; bucket i = scores in [i*10, i*10+10)
  sampleCount: number;
}

export const bucketOf = (score: number): number =>
  Math.min(89, Math.floor(score / 10));

// Below this many players a percentile is more noise than signal.
export const MIN_SAMPLE = 20;

// "Better than X%": the share of players you beat, counting half of your
// own bucket — the midpoint convention, so the result doesn't flip-flop
// with bucket granularity. Clamped to [0, 99]: the day's best score reads
// "better than 99%" (you can't beat yourself), the worst reads 0%.
export function betterThanPercent(
  score: number,
  d: Distribution,
): number | null {
  if (d.sampleCount < MIN_SAMPLE || d.histogram.length === 0) return null;
  const bucket = bucketOf(score);
  let better = 0;
  for (let i = 0; i < bucket && i < d.histogram.length; i++) {
    better += d.histogram[i];
  }
  // If the hourly batch hasn't aggregated the player's own score yet, count
  // them as their bucket's sole occupant rather than nobody.
  const own = Math.max(1, d.histogram[bucket] ?? 0);
  const topPct = (100 * (better + 0.5 * own)) / d.sampleCount;
  // floor, not round: never claim the player beat more people than they did
  return Math.min(99, Math.max(0, Math.floor(100 - topPct)));
}
