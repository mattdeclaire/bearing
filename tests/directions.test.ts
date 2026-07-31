import { describe, expect, it } from "vitest";
import {
  AT_CITY_KM,
  angularDiff,
  bearingTo,
  buildShareText,
  distanceKm,
  gradeEmoji,
  scoreOf,
  SITE_URL,
} from "../src/lib/directions.ts";
import { monthKey, todayKey } from "../src/lib/today.ts";
import { buildMonth, citiesForDay } from "../scripts/gen-days.ts";

const LONDON = { lat: 51.5074, lon: -0.1278 };
const NYC = { lat: 40.7128, lon: -74.006 };
const SYDNEY = { lat: -33.8688, lon: 151.2093 };
const TOKYO = { lat: 35.6762, lon: 139.6503 };

describe("bearingTo", () => {
  it("London → New York is roughly WNW (~288°)", () => {
    expect(bearingTo(LONDON, NYC)).toBeCloseTo(288.4, 0);
  });

  it("New York → London is roughly ENE (~51°)", () => {
    expect(bearingTo(NYC, LONDON)).toBeCloseTo(51.2, 0);
  });

  it("Tokyo → Sydney is roughly S (~170°)", () => {
    expect(bearingTo(TOKYO, SYDNEY)).toBeCloseTo(169.8, 0);
  });

  it("due north from equator", () => {
    expect(bearingTo({ lat: 0, lon: 0 }, { lat: 10, lon: 0 })).toBeCloseTo(0, 5);
  });

  it("due east along the equator", () => {
    expect(bearingTo({ lat: 0, lon: 0 }, { lat: 0, lon: 10 })).toBeCloseTo(90, 5);
  });

  it("always returns [0, 360)", () => {
    expect(bearingTo(NYC, LONDON)).toBeGreaterThanOrEqual(0);
    expect(bearingTo(LONDON, NYC)).toBeLessThan(360);
  });
});

describe("angularDiff", () => {
  it("simple difference", () => {
    expect(angularDiff(10, 50)).toBe(40);
  });

  it("wraps around 0/360", () => {
    expect(angularDiff(350, 10)).toBe(20);
    expect(angularDiff(10, 350)).toBe(20);
  });

  it("maximum is 180", () => {
    expect(angularDiff(0, 180)).toBe(180);
    expect(angularDiff(90, 270)).toBe(180);
  });

  it("identical angles give 0", () => {
    expect(angularDiff(123.4, 123.4)).toBe(0);
  });

  it("handles negative inputs", () => {
    expect(angularDiff(-10, 10)).toBe(20);
  });
});

describe("gradeEmoji", () => {
  it("tiers by error size", () => {
    expect(gradeEmoji(0)).toBe("🎯");
    expect(gradeEmoji(10)).toBe("🎯");
    expect(gradeEmoji(11)).toBe("🟢");
    expect(gradeEmoji(60)).toBe("🟡");
    expect(gradeEmoji(110)).toBe("🟠");
    expect(gradeEmoji(180)).toBe("🔴");
  });
});

describe("distanceKm", () => {
  it("zero for identical points", () => {
    expect(distanceKm(LONDON, LONDON)).toBe(0);
  });

  it("London → New York is ~5570 km", () => {
    expect(distanceKm(LONDON, NYC)).toBeCloseTo(5570, -2);
  });

  it("is symmetric", () => {
    expect(distanceKm(TOKYO, SYDNEY)).toBeCloseTo(distanceKm(SYDNEY, TOKYO), 6);
  });

  it("0.1° of latitude is ~11 km — inside the at-city radius", () => {
    const d = distanceKm(LONDON, { lat: LONDON.lat + 0.1, lon: LONDON.lon });
    expect(d).toBeCloseTo(11.1, 0);
    expect(d).toBeLessThan(AT_CITY_KM);
  });

  it("a neighboring city stays outside the at-city radius", () => {
    // Amsterdam → Utrecht, ~35 km apart
    const amsterdam = { lat: 52.3676, lon: 4.9041 };
    const utrecht = { lat: 52.0907, lon: 5.1214 };
    expect(distanceKm(amsterdam, utrecht)).toBeGreaterThan(AT_CITY_KM);
  });
});

describe("scoreOf", () => {
  it("sums the errors and rounds", () => {
    const results = [5.3, 20.4, 50, 100, 170].map((error) => ({
      name: "A",
      country: "X",
      lat: 0,
      lon: 0,
      guess: 0,
      actual: 0,
      error,
    }));
    expect(scoreOf(results)).toBe(346); // round(345.7)
    expect(scoreOf([])).toBe(0);
  });
});

describe("buildShareText", () => {
  it("formats the result line with total, count, emojis, and URL", () => {
    const results = [
      { name: "A", country: "X", lat: 0, lon: 0, guess: 0, actual: 5, error: 5 },
      { name: "B", country: "X", lat: 0, lon: 0, guess: 0, actual: 20, error: 20 },
      { name: "C", country: "X", lat: 0, lon: 0, guess: 0, actual: 50, error: 50 },
      { name: "D", country: "X", lat: 0, lon: 0, guess: 0, actual: 100, error: 100 },
      { name: "E", country: "X", lat: 0, lon: 0, guess: 0, actual: 170, error: 170 },
    ];
    const text = buildShareText(results, "continental");
    expect(text).toBe(
      `Bearing · 345° off over 5 cities · 🎯🟢🟡🟠🔴\n${SITE_URL}`,
    );
  });

  it("labels the global mode and never names a continent", () => {
    const results = [
      { name: "A", country: "X", lat: 0, lon: 0, guess: 0, actual: 5, error: 5 },
      { name: "B", country: "X", lat: 0, lon: 0, guess: 0, actual: 20, error: 20 },
      { name: "C", country: "X", lat: 0, lon: 0, guess: 0, actual: 50, error: 50 },
      { name: "D", country: "X", lat: 0, lon: 0, guess: 0, actual: 100, error: 100 },
      { name: "E", country: "X", lat: 0, lon: 0, guess: 0, actual: 170, error: 170 },
    ];
    const text = buildShareText(results, "global");
    expect(text).toBe(
      `Bearing (Global) · 345° off over 5 cities · 🎯🟢🟡🟠🔴\n${SITE_URL}`,
    );
  });
});

describe("todayKey", () => {
  it("formats a local date as YYYY-MM-DD with zero padding", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("monthKey", () => {
  it("is the YYYY-MM prefix of the local date", () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe("2026-01");
    expect(monthKey(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("buildMonth", () => {
  it("covers every day of the month with 5 cities each", () => {
    const feb = buildMonth(2026, 2);
    expect(Object.keys(feb)).toHaveLength(28);
    expect(feb["2026-02-01"]).toHaveLength(5);
    expect(feb["2026-02-28"]).toHaveLength(5);
    expect(feb["2026-02-29"]).toBeUndefined();
  });

  it("handles leap years", () => {
    expect(Object.keys(buildMonth(2028, 2))).toHaveLength(29);
  });

  it("month entries match the per-day generator", () => {
    expect(buildMonth(2026, 7)["2026-07-18"]).toEqual(citiesForDay("2026-07-18"));
  });
});

describe("declinationAt", () => {
  it("matches known WMM values within a degree", async () => {
    const { declinationAt } = await import("../src/lib/declination.ts");
    const d = new Date("2026-07-18");
    expect(declinationAt({ lat: 47.6, lon: -122.3 }, d)).toBeCloseTo(14.9, 0); // Seattle, east
    expect(declinationAt({ lat: 64.15, lon: -21.94 }, d)).toBeCloseTo(-11.1, 0); // Reykjavík, west
    expect(Math.abs(declinationAt({ lat: 51.5, lon: -0.13 }, d))).toBeLessThan(3); // London, near zero
  });
});

describe("citiesForDay", () => {
  it("returns exactly 5 distinct cities", () => {
    const cities = citiesForDay("2026-07-17");
    expect(cities).toHaveLength(5);
    expect(new Set(cities.map((c) => c.name)).size).toBe(5);
  });

  it("is deterministic for the same date", () => {
    expect(citiesForDay("2026-07-17")).toEqual(citiesForDay("2026-07-17"));
  });

  it("differs across dates", () => {
    expect(citiesForDay("2026-07-17")).not.toEqual(citiesForDay("2026-07-18"));
  });

  it("draws only from the requested continent", () => {
    const cities = citiesForDay("2026-08-01", "europe");
    expect(cities).toHaveLength(5);
    expect(new Set(cities.map((c) => c.name)).size).toBe(5);
    expect(cities.every((c) => c.continent === "europe")).toBe(true);
  });

  it("is deterministic per continent", () => {
    expect(citiesForDay("2026-08-01", "europe")).toEqual(
      citiesForDay("2026-08-01", "europe"),
    );
  });

  it("differs across continents and from global on the same date", () => {
    const europe = citiesForDay("2026-08-01", "europe");
    expect(europe).not.toEqual(citiesForDay("2026-08-01", "asia"));
    expect(europe).not.toEqual(citiesForDay("2026-08-01"));
  });

  it("builds a full month for a continent", () => {
    const month = buildMonth(2026, 8, "oceania");
    expect(Object.keys(month)).toHaveLength(31);
    for (const cities of Object.values(month)) {
      expect(cities).toHaveLength(5);
      expect(cities.every((c) => c.continent === "oceania")).toBe(true);
    }
  });
});
