import { mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CITIES, type City } from "../src/lib/cities.ts";

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

export function citiesForDay(dateKey: string): City[] {
  const rand = mulberry32(hashString(`bearing:${dateKey}`));
  const pool = [...CITIES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, CITIES_PER_DAY);
}

function dateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function main() {
  const force = process.argv.includes("--force");
  mkdirSync(DAYS_DIR, { recursive: true });

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 1);
  let written = 0;
  let skipped = 0;

  for (let i = 0; i <= WINDOW_DAYS + 1; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const key = dateKeyUTC(d);
    const file = join(DAYS_DIR, `${key}.json`);
    if (existsSync(file) && !force) {
      skipped++;
      continue;
    }
    writeFileSync(file, JSON.stringify(citiesForDay(key), null, 2) + "\n");
    written++;
  }

  const total = readdirSync(DAYS_DIR).filter((f) => f.endsWith(".json")).length;
  console.log(`gen-days: wrote ${written}, skipped ${skipped} existing, ${total} total day files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
