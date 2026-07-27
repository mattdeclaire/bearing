import { describe, expect, it } from "vitest";
import {
  nextTooVertical,
  screenTilt,
  TILT_ENTER_DEG,
  TILT_EXIT_DEG,
} from "../src/lib/tilt.ts";

describe("screenTilt", () => {
  it("is 0 when flat face-up", () => {
    expect(screenTilt(0, 0)).toBeCloseTo(0, 6);
  });

  it("is 90 when vertical in portrait or landscape", () => {
    expect(screenTilt(90, 0)).toBeCloseTo(90, 6);
    expect(screenTilt(0, 90)).toBeCloseTo(90, 6);
    expect(screenTilt(0, -90)).toBeCloseTo(90, 6);
    expect(screenTilt(90, 90)).toBeCloseTo(90, 6);
  });

  it("matches the tilt for simple pitches", () => {
    expect(screenTilt(45, 0)).toBeCloseTo(45, 6);
    expect(screenTilt(-45, 0)).toBeCloseTo(45, 6);
  });

  it("is 180 when face-down", () => {
    expect(screenTilt(180, 0)).toBeCloseTo(180, 6);
  });

  it("combines both axes", () => {
    // cos(60°)·cos(45°) = 0.3536 → 69.3°
    expect(screenTilt(60, 45)).toBeCloseTo(69.3, 1);
  });

  it("is symmetric under sign flips", () => {
    expect(screenTilt(37, -12)).toBeCloseTo(screenTilt(-37, 12), 10);
  });

  it("stays finite and in [0, 180] across the spec ranges", () => {
    for (let beta = -180; beta <= 180; beta += 15) {
      for (let gamma = -90; gamma <= 90; gamma += 15) {
        const t = screenTilt(beta, gamma);
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("nextTooVertical", () => {
  it("has exit below enter", () => {
    expect(TILT_EXIT_DEG).toBeLessThan(TILT_ENTER_DEG);
  });

  it("engages at the enter threshold", () => {
    expect(nextTooVertical(false, TILT_ENTER_DEG - 0.1)).toBe(false);
    expect(nextTooVertical(false, TILT_ENTER_DEG)).toBe(true);
    expect(nextTooVertical(false, 90)).toBe(true);
  });

  it("releases at the exit threshold", () => {
    expect(nextTooVertical(true, TILT_EXIT_DEG + 0.1)).toBe(true);
    expect(nextTooVertical(true, TILT_EXIT_DEG)).toBe(false);
    expect(nextTooVertical(true, 0)).toBe(false);
  });

  it("holds the previous state inside the dead band", () => {
    const mid = (TILT_ENTER_DEG + TILT_EXIT_DEG) / 2;
    expect(nextTooVertical(true, mid)).toBe(true);
    expect(nextTooVertical(false, mid)).toBe(false);
  });

  it("holds on NaN", () => {
    expect(nextTooVertical(true, NaN)).toBe(true);
    expect(nextTooVertical(false, NaN)).toBe(false);
  });

  it("walks the full raise-and-lower sequence", () => {
    let s = false;
    s = nextTooVertical(s, 20); // flat
    expect(s).toBe(false);
    s = nextTooVertical(s, 80); // raised to camera pose
    expect(s).toBe(true);
    s = nextTooVertical(s, 55); // partial tip down — dead band holds
    expect(s).toBe(true);
    s = nextTooVertical(s, 45); // tipped down flat enough
    expect(s).toBe(false);
  });
});
