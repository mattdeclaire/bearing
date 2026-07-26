import { mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CITIES, CONTINENTS, type City, type Continent } from "../src/lib/cities.ts";

const DAYS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "days");
const CITIES_PER_DAY = 5;
const WINDOW_DAYS = 365;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-date: a given date always yields the same 5 cities, so
// regenerating (or regrouping into month files) never changes a published day.
// Without a continent this is the global game (seed unchanged from launch —
// published global months must never shift); with one, the pool narrows to
// that continent and the seed gets its own stream.
export function citiesForDay(dateKey: string, continent?: Continent): City[] {
  const seed = continent ? `bearing:${continent}:${dateKey}` : `bearing:${dateKey}`;
  const rand = mulberry32(hashString(seed));
  const pool = continent ? CITIES.filter((c) => c.continent === continent) : [...CITIES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, CITIES_PER_DAY);
}

// One file per month: { "YYYY-MM-DD": City[5], ... } for every day of the month.
export function buildMonth(
  year: number,
  month: number,
  continent?: Continent,
): Record<string, City[]> {
  const out: Record<string, City[]> = {};
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    out[key] = citiesForDay(key, continent);
  }
  return out;
}

function main() {
  const force = process.argv.includes("--force");

  // Seven streams: the global game (files directly in days/) plus one
  // subdirectory per continent.
  const streams: (Continent | null)[] = [null, ...CONTINENTS];
  for (const continent of streams) {
    mkdirSync(continent ? join(DAYS_DIR, continent) : DAYS_DIR, { recursive: true });
  }

  // Cover every month that intersects [yesterday, one year out]. Months are
  // always written complete, then never touched again (absent --force).
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS + 1);

  let written = 0;
  let skipped = 0;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const monthFile = `${y}-${String(m).padStart(2, "0")}.json`;
    for (const continent of streams) {
      const file = continent
        ? join(DAYS_DIR, continent, monthFile)
        : join(DAYS_DIR, monthFile);
      if (existsSync(file) && !force) {
        skipped++;
      } else {
        writeFileSync(file, JSON.stringify(buildMonth(y, m, continent ?? undefined), null, 2) + "\n");
        written++;
      }
    }
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  const countMonthFiles = (dir: string) =>
    readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).length;
  const total = streams.reduce(
    (sum, continent) => sum + countMonthFiles(continent ? join(DAYS_DIR, continent) : DAYS_DIR),
    0,
  );
  console.log(`gen-days: wrote ${written}, skipped ${skipped} existing, ${total} total month files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
