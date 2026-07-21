import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationPoint,
  globeCenter,
  greatCircleSegments,
  orthoProject,
} from "../src/lib/orthographic.ts";
import { bearingTo } from "../src/lib/directions.ts";
import type { CityResult } from "../src/lib/directions.ts";

const R = 150;

const mkResult = (lat: number, lon: number): CityResult => ({
  name: "x",
  country: "y",
  lat,
  lon,
  guess: 0,
  actual: 0,
  error: 0,
});

describe("orthoProject", () => {
  it("projects the center to the origin, front", () => {
    const p = orthoProject({ lat: 40, lon: -74 }, { lat: 40, lon: -74 }, R);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.front).toBe(true);
  });

  it("puts a point 90° east on the disc edge", () => {
    const p = orthoProject({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }, R);
    expect(p.x).toBeCloseTo(R, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("marks the far hemisphere as back", () => {
    expect(orthoProject({ lat: 0, lon: 0 }, { lat: 0, lon: 135 }, R).front).toBe(false);
    expect(orthoProject({ lat: 0, lon: 0 }, { lat: 0, lon: 45 }, R).front).toBe(true);
  });
});

describe("greatCircleSegments", () => {
  it("splits a route crossing the horizon into front and back runs", () => {
    // center on New York, route from New York to Perth (~170° away)
    const center = { lat: 40.7, lon: -74 };
    const runs = greatCircleSegments(center, center, { lat: -31.95, lon: 115.86 }, R);
    expect(runs.some((r) => r.front)).toBe(true);
    expect(runs.some((r) => !r.front)).toBe(true);
  });

  it("keeps a short route entirely on the front", () => {
    const center = { lat: 40.7, lon: -74 };
    const runs = greatCircleSegments(center, center, { lat: 41.9, lon: -87.6 }, R);
    expect(runs.every((r) => r.front)).toBe(true);
  });
});

describe("destinationPoint", () => {
  it("travels due north", () => {
    const p = destinationPoint({ lat: 10, lon: 20 }, 0, 5);
    expect(p.lat).toBeCloseTo(15, 5);
    expect(p.lon).toBeCloseTo(20, 5);
  });

  it("initial bearing of the result matches the requested bearing", () => {
    const from = { lat: 40.7, lon: -74 };
    const p = destinationPoint(from, 137, 5);
    expect(bearingTo(from, p)).toBeCloseTo(137, 1);
  });
});

describe("globeCenter", () => {
  const pos = { lat: 40, lon: -74 };

  it("keeps the player's longitude", () => {
    const c = globeCenter(pos, [mkResult(-30, 100), mkResult(10, 20)]);
    expect(c.lon).toBe(pos.lon);
  });

  it("tilts toward the cities' mean latitude", () => {
    const c = globeCenter(pos, [mkResult(10, 0), mkResult(20, 0)]);
    expect(c.lat).toBeCloseTo(15, 5);
  });

  it("clamps the tilt to 45° in both directions", () => {
    expect(globeCenter(pos, [mkResult(-80, 0)]).lat).toBeCloseTo(-5, 5);
    expect(globeCenter({ lat: -40, lon: 0 }, [mkResult(85, 0)]).lat).toBeCloseTo(5, 5);
  });
});

describe("land.json", () => {
  it("has plausible simplified coastline data", () => {
    const rings = JSON.parse(
      readFileSync(join(__dirname, "..", "public", "land.json"), "utf8"),
    ) as [number, number][][];
    expect(rings.length).toBeGreaterThan(50);
    for (const ring of rings) {
      expect(ring.length).toBeGreaterThanOrEqual(8);
      for (const [lon, lat] of ring) {
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }
    }
  });
});
