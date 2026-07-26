import { describe, expect, it } from "vitest";
import { CITIES, CONTINENTS } from "../src/lib/cities.ts";

describe("CITIES", () => {
  it("assigns every city a known continent", () => {
    for (const city of CITIES) {
      expect(CONTINENTS).toContain(city.continent);
    }
  });

  it("has at least 12 cities per continent (5-city puzzles need variety)", () => {
    for (const continent of CONTINENTS) {
      const count = CITIES.filter((c) => c.continent === continent).length;
      expect(count, continent).toBeGreaterThanOrEqual(12);
    }
  });

  it("has unique city names", () => {
    const names = CITIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has coordinates in range", () => {
    for (const city of CITIES) {
      expect(city.lat, city.name).toBeGreaterThanOrEqual(-90);
      expect(city.lat, city.name).toBeLessThanOrEqual(90);
      expect(city.lon, city.name).toBeGreaterThanOrEqual(-180);
      expect(city.lon, city.name).toBeLessThanOrEqual(180);
    }
  });
});
