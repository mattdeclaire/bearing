import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadResult, saveResult } from "../src/lib/storage.ts";
import type { CityResult } from "../src/lib/directions.ts";

// Vitest runs in node here — provide a minimal in-memory localStorage.
function makeMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
}

const storage = makeMemoryStorage();
vi.stubGlobal("localStorage", storage);

const DATE = "2026-07-26";

const results: CityResult[] = Array.from({ length: 5 }, (_, i) => ({
  name: `City ${i}`,
  country: "X",
  lat: i,
  lon: i,
  guess: 0,
  actual: 10,
  error: 10,
}));

describe("storage", () => {
  beforeEach(() => storage.clear());

  it("round-trips a result per mode", () => {
    saveResult("continental", DATE, results, { lat: 52.52, lon: 13.405 });
    const saved = loadResult("continental", DATE);
    expect(saved?.results).toEqual(results);
    expect(saved?.pos).toEqual({ lat: 52.5, lon: 13.4 });
  });

  it("keeps modes independent", () => {
    saveResult("continental", DATE, results, null);
    expect(loadResult("global", DATE)).toBeNull();
    saveResult("global", DATE, results, null);
    expect(loadResult("continental", DATE)).not.toBeNull();
    expect(loadResult("global", DATE)).not.toBeNull();
  });

  it("returns null for a different date", () => {
    saveResult("global", DATE, results, null);
    expect(loadResult("global", "2026-07-27")).toBeNull();
  });

  it("reads legacy pre-mode saves as global only", () => {
    localStorage.setItem(
      "bearing:lastResult",
      JSON.stringify({ dateKey: DATE, results, pos: null }),
    );
    expect(loadResult("global", DATE)?.results).toEqual(results);
    expect(loadResult("continental", DATE)).toBeNull();
  });

  it("prefers the mode key over the legacy key", () => {
    const legacy = results.map((r) => ({ ...r, name: `Legacy ${r.name}` }));
    localStorage.setItem(
      "bearing:lastResult",
      JSON.stringify({ dateKey: DATE, results: legacy, pos: null }),
    );
    saveResult("global", DATE, results, null);
    expect(loadResult("global", DATE)?.results).toEqual(results);
  });
});
