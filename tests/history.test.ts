import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadHistory,
  mergeHistory,
  recordGame,
  type HistoryEntry,
} from "../src/lib/history.ts";

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

const entry = (dateKey: string, score = 100): HistoryEntry => ({
  dateKey,
  score,
  errors: [10, 20, 30, 20, 20],
});

describe("history", () => {
  beforeEach(() => storage.clear());

  it("round-trips entries sorted by date", () => {
    recordGame("global", entry("2026-07-27"));
    recordGame("global", entry("2026-07-25"));
    recordGame("global", entry("2026-07-26"));
    expect(loadHistory("global").map((e) => e.dateKey)).toEqual([
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
    ]);
  });

  it("upserts by dateKey — replaying a day never duplicates", () => {
    recordGame("global", entry("2026-07-26", 100));
    recordGame("global", entry("2026-07-26", 200));
    const history = loadHistory("global");
    expect(history).toHaveLength(1);
    expect(history[0].score).toBe(200);
  });

  it("keeps modes independent", () => {
    recordGame("continental", entry("2026-07-26"));
    expect(loadHistory("global")).toEqual([]);
    expect(loadHistory("continental")).toHaveLength(1);
  });

  it("preserves the continent field", () => {
    recordGame("continental", { ...entry("2026-07-26"), continent: "europe" });
    expect(loadHistory("continental")[0].continent).toBe("europe");
  });

  it("drops malformed entries without nuking the rest", () => {
    localStorage.setItem(
      "bearing:history:global",
      JSON.stringify([
        entry("2026-07-25"),
        { dateKey: "not-a-date", score: 1, errors: [1, 2, 3, 4, 5] },
        { dateKey: "2026-07-26", score: "high", errors: [1, 2, 3, 4, 5] },
        { dateKey: "2026-07-27", score: 1, errors: [1, 2, 3] },
        { dateKey: "2026-07-28", score: 1, errors: [1, 2, 3, 4, "x"] },
        null,
        "junk",
        { ...entry("2026-07-29"), continent: "atlantis" },
      ]),
    );
    const history = loadHistory("global");
    expect(history.map((e) => e.dateKey)).toEqual(["2026-07-25", "2026-07-29"]);
    // unknown continent is stripped, not fatal
    expect(history[1].continent).toBeUndefined();
  });

  it("merges restored entries, local wins on conflict", () => {
    recordGame("global", entry("2026-07-28", 100));
    const added = mergeHistory("global", [
      entry("2026-07-27", 300), // new day → added
      entry("2026-07-28", 999), // conflict → local 100 kept
    ]);
    expect(added).toBe(1);
    expect(loadHistory("global").map((e) => [e.dateKey, e.score])).toEqual([
      ["2026-07-27", 300],
      ["2026-07-28", 100],
    ]);
  });

  it("merge validates incoming entries and reports zero when nothing new", () => {
    recordGame("global", entry("2026-07-28"));
    expect(
      mergeHistory("global", [
        entry("2026-07-28"),
        { dateKey: "bad", score: 1, errors: [1, 2, 3, 4, 5] },
      ]),
    ).toBe(0);
    expect(loadHistory("global")).toHaveLength(1);
  });

  it("returns [] for garbage or missing data", () => {
    expect(loadHistory("global")).toEqual([]);
    localStorage.setItem("bearing:history:global", "not json");
    expect(loadHistory("global")).toEqual([]);
    localStorage.setItem("bearing:history:global", JSON.stringify({ a: 1 }));
    expect(loadHistory("global")).toEqual([]);
  });
});
