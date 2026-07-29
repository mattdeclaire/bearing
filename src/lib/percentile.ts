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

// "Top X%": the share of players scoring better than (or tied with) you,
// counting half of your own bucket — the midpoint convention, so the result
// doesn't flip-flop with bucket granularity. Clamped to [1, 100]: the best
// score of the day reads "Top 1%", never "Top 0%".
export function topPercent(score: number, d: Distribution): number | null {
  if (d.sampleCount < MIN_SAMPLE || d.histogram.length === 0) return null;
  const bucket = bucketOf(score);
  let better = 0;
  for (let i = 0; i < bucket && i < d.histogram.length; i++) {
    better += d.histogram[i];
  }
  const own = d.histogram[bucket] ?? 0;
  const pct = Math.round((100 * (better + 0.5 * Math.max(1, own))) / d.sampleCount);
  return Math.min(100, Math.max(1, pct));
}
