import { describe, expect, it } from "vitest";
import { computeModeStats, computeStreaks } from "../src/lib/stats.ts";
import type { HistoryEntry } from "../src/lib/history.ts";

const entry = (dateKey: string, score: number): HistoryEntry => ({
  dateKey,
  score,
  errors: [score / 5, score / 5, score / 5, score / 5, score / 5],
});

describe("computeModeStats", () => {
  it("handles an empty history", () => {
    expect(computeModeStats([])).toEqual({
      gamesPlayed: 0,
      averageScore: null,
      bestScore: null,
      distribution: [0, 0, 0, 0, 0],
    });
  });

  it("computes games, average, and best", () => {
    const stats = computeModeStats([
      entry("2026-07-25", 100),
      entry("2026-07-26", 200),
      entry("2026-07-27", 331),
    ]);
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.averageScore).toBe(210); // round(631 / 3)
    expect(stats.bestScore).toBe(100);
  });

  it("buckets scores by grade tier at the edges", () => {
    // Tier boundaries in total score: 🎯 ≤50, 🟢 ≤125, 🟡 ≤300, 🟠 ≤550, 🔴 else
    const stats = computeModeStats([
      entry("2026-01-01", 0),
      entry("2026-01-02", 50),
      entry("2026-01-03", 51),
      entry("2026-01-04", 125),
      entry("2026-01-05", 126),
      entry("2026-01-06", 300),
      entry("2026-01-07", 301),
      entry("2026-01-08", 550),
      entry("2026-01-09", 551),
      entry("2026-01-10", 900),
    ]);
    expect(stats.distribution).toEqual([2, 2, 2, 2, 2]);
  });
});

describe("computeStreaks", () => {
  it("is zero for no games", () => {
    expect(computeStreaks([], "2026-07-29")).toEqual({ current: 0, max: 0 });
  });

  it("counts a single game today", () => {
    expect(computeStreaks(["2026-07-29"], "2026-07-29")).toEqual({
      current: 1,
      max: 1,
    });
  });

  it("keeps the streak alive before today's game (played-yesterday grace)", () => {
    expect(
      computeStreaks(["2026-07-27", "2026-07-28"], "2026-07-29"),
    ).toEqual({ current: 2, max: 2 });
  });

  it("resets current after a full missed day, keeping max", () => {
    expect(
      computeStreaks(["2026-07-25", "2026-07-26", "2026-07-27"], "2026-07-29"),
    ).toEqual({ current: 0, max: 3 });
  });

  it("tracks current and max separately", () => {
    expect(
      computeStreaks(
        ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-28", "2026-07-29"],
        "2026-07-29",
      ),
    ).toEqual({ current: 2, max: 3 });
  });

  it("ignores duplicate dates (both modes played the same day)", () => {
    expect(
      computeStreaks(["2026-07-28", "2026-07-28", "2026-07-29"], "2026-07-29"),
    ).toEqual({ current: 2, max: 2 });
  });

  it("spans month boundaries", () => {
    expect(
      computeStreaks(["2026-01-31", "2026-02-01"], "2026-02-01"),
    ).toEqual({ current: 2, max: 2 });
  });

  it("spans year boundaries", () => {
    expect(
      computeStreaks(["2025-12-31", "2026-01-01"], "2026-01-01"),
    ).toEqual({ current: 2, max: 2 });
  });

  it("spans a DST spring-forward boundary", () => {
    // 2026-03-08 is the US spring-forward date; UTC-noon parsing keeps
    // consecutive local dates exactly one day apart regardless of timezone.
    expect(
      computeStreaks(["2026-03-07", "2026-03-08", "2026-03-09"], "2026-03-09"),
    ).toEqual({ current: 3, max: 3 });
  });
});
