import { describe, expect, it } from "vitest";
import { CONTINENTS } from "../src/lib/cities.ts";
import { detectContinent } from "../src/lib/continent.ts";

describe("detectContinent", () => {
  it("maps well-known locations to their continent", () => {
    expect(detectContinent({ lat: 52.52, lon: 13.405 })).toBe("europe"); // Berlin
    expect(detectContinent({ lat: 39, lon: -98 })).toBe("north-america"); // Kansas
    expect(detectContinent({ lat: 21.31, lon: -157.86 })).toBe("oceania"); // Honolulu
    expect(detectContinent({ lat: 64.15, lon: -21.94 })).toBe("europe"); // Reykjavík
    expect(detectContinent({ lat: 1.35, lon: 103.82 })).toBe("asia"); // Singapore
    expect(detectContinent({ lat: -33.92, lon: 18.42 })).toBe("africa"); // Cape Town
    expect(detectContinent({ lat: -36.85, lon: 174.76 })).toBe("oceania"); // Auckland
    expect(detectContinent({ lat: -34.6, lon: -58.38 })).toBe("south-america"); // Buenos Aires
  });

  it("resolves locations far from any city to some continent", () => {
    // Mid-Atlantic: the answer just has to be deterministic and valid.
    const c = detectContinent({ lat: 30, lon: -40 });
    expect(CONTINENTS).toContain(c);
    expect(detectContinent({ lat: 30, lon: -40 })).toBe(c);
  });
});
