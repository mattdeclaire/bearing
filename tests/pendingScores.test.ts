import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueue,
  loadQueue,
  pruneExpired,
  saveQueue,
  type ScoreSubmission,
} from "../src/lib/pendingScores.ts";

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

const sub = (
  dateKey: string,
  mode: ScoreSubmission["mode"] = "global",
): ScoreSubmission => ({
  dateKey,
  mode,
  continent: mode === "continental" ? "europe" : null,
  score: 123,
  errors: [10, 20, 30, 30, 33],
  input: "manual",
});

describe("pendingScores queue", () => {
  beforeEach(() => storage.clear());

  it("round-trips submissions", () => {
    saveQueue([sub("2026-07-28"), sub("2026-07-29", "continental")]);
    expect(loadQueue()).toEqual([
      sub("2026-07-28"),
      sub("2026-07-29", "continental"),
    ]);
  });

  it("enqueue upserts by (dateKey, mode)", () => {
    let q = enqueue([], sub("2026-07-29"));
    q = enqueue(q, { ...sub("2026-07-29"), score: 456 });
    expect(q).toHaveLength(1);
    expect(q[0].score).toBe(456);
    // same day, other mode is a separate submission
    q = enqueue(q, sub("2026-07-29", "continental"));
    expect(q).toHaveLength(2);
  });

  it("prunes entries the server would reject as too old", () => {
    const q = [sub("2026-07-26"), sub("2026-07-27"), sub("2026-07-29")];
    expect(pruneExpired(q, "2026-07-29").map((s) => s.dateKey)).toEqual([
      "2026-07-27",
      "2026-07-29",
    ]);
  });

  it("drops malformed and inconsistent entries on load", () => {
    localStorage.setItem(
      "bearing:pendingScores",
      JSON.stringify([
        sub("2026-07-29"),
        { ...sub("2026-07-28"), continent: "europe" }, // global + continent
        { ...sub("2026-07-28", "continental"), continent: null }, // continental w/o continent
        { ...sub("2026-07-28"), errors: [1, 2] },
        { ...sub("2026-07-28"), input: "psychic" },
        "junk",
      ]),
    );
    expect(loadQueue()).toEqual([sub("2026-07-29")]);
  });

  it("returns [] for garbage", () => {
    localStorage.setItem("bearing:pendingScores", "not json");
    expect(loadQueue()).toEqual([]);
  });
});
