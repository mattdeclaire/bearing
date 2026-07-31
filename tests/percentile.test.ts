import { describe, expect, it } from "vitest";
import {
  betterThanPercent,
  bucketOf,
  MIN_SAMPLE,
  type Distribution,
} from "../src/lib/percentile.ts";

// histogram with counts at given (bucket, count) pairs, zeros elsewhere
function dist(entries: [number, number][]): Distribution {
  const histogram = Array.from({ length: 90 }, () => 0);
  let sampleCount = 0;
  for (const [bucket, count] of entries) {
    histogram[bucket] += count;
    sampleCount += count;
  }
  return { histogram, sampleCount };
}

describe("bucketOf", () => {
  it("maps scores to 10° buckets", () => {
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(9)).toBe(0);
    expect(bucketOf(10)).toBe(1);
    expect(bucketOf(895)).toBe(89);
  });

  it("folds the maximum score 900 into the last bucket", () => {
    expect(bucketOf(900)).toBe(89);
  });
});

describe("betterThanPercent", () => {
  it("returns null below the sample floor", () => {
    expect(betterThanPercent(100, dist([[10, MIN_SAMPLE - 1]]))).toBeNull();
    expect(
      betterThanPercent(100, { histogram: [], sampleCount: 100 }),
    ).toBeNull();
  });

  it("caps the day's best score at 99% — you can't beat yourself", () => {
    // 1 great score, 99 bad ones
    expect(betterThanPercent(5, dist([[0, 1], [50, 99]]))).toBe(99);
  });

  it("floors the worst score at 0%", () => {
    expect(betterThanPercent(890, dist([[0, 99], [89, 1]]))).toBe(0);
  });

  it("puts the middle of a uniform field near 55%", () => {
    // 10 players in each of buckets 0..9; score 45 sits in bucket 4:
    // 50 strictly worse + half of own 10 = 55 of 100
    const d = dist(Array.from({ length: 10 }, (_, i) => [i, 10]));
    expect(betterThanPercent(45, d)).toBe(55);
  });

  it("uses the midpoint of the player's own bucket", () => {
    // everyone scored in the same bucket → you're at the middle of the pack
    expect(betterThanPercent(100, dist([[10, 100]]))).toBe(50);
  });

  it("counts at least one own-bucket occupant even if the histogram is stale", () => {
    // the player's own score may not be aggregated yet (hourly batch)
    const d = dist([[0, 20]]);
    expect(betterThanPercent(500, d)).toBe(0); // everyone else is better
  });
});
