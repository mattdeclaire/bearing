import { describe, expect, it } from "vitest";
import { parseScoreRow } from "../src/lib/backend.ts";

// Only the pure server-row parsing is tested — network paths stay untested,
// consistent with the rest of the suite. (Importing backend.ts is safe in
// node: supabase-js is only pulled in by a dynamic import that never runs
// with the config empty.)

const row = {
  date: "2026-07-29",
  mode: "continental",
  continent: "europe",
  score: 338,
  errors: [89, 77, 59, 74, 40],
};

describe("parseScoreRow", () => {
  it("maps a continental row to a history entry", () => {
    expect(parseScoreRow(row)).toEqual({
      mode: "continental",
      entry: {
        dateKey: "2026-07-29",
        score: 338,
        errors: [89, 77, 59, 74, 40],
        continent: "europe",
      },
    });
  });

  it("maps a global row without a continent", () => {
    const parsed = parseScoreRow({ ...row, mode: "global", continent: null });
    expect(parsed?.mode).toBe("global");
    expect(parsed?.entry.continent).toBeUndefined();
  });

  it("rejects malformed rows", () => {
    expect(parseScoreRow(null)).toBeNull();
    expect(parseScoreRow({ ...row, date: "yesterday" })).toBeNull();
    expect(parseScoreRow({ ...row, mode: "practice" })).toBeNull();
    expect(parseScoreRow({ ...row, score: "338" })).toBeNull();
    expect(parseScoreRow({ ...row, errors: [1, 2, 3] })).toBeNull();
  });

  it("drops an unknown continent but keeps the row", () => {
    const parsed = parseScoreRow({ ...row, continent: "atlantis" });
    expect(parsed?.entry.continent).toBeUndefined();
  });
});
