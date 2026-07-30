import type { GameMode } from "./gameMode.ts";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface CityResult {
  name: string;
  country: string;
  lat: number;
  lon: number;
  guess: number;
  actual: number;
  error: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function bearingTo(from: LatLon, to: LatLon): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function angularDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

const EARTH_RADIUS_KM = 6371;

// Haversine great-circle distance.
export function distanceKm(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lon - a.lon);
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Inside the target city, "which way is the city?" has no honest answer —
// the bearing to its reference coordinate is arbitrary (pure GPS noise when
// you're near the point). Within this radius the round scores an automatic
// bullseye instead. 25 km covers most metro areas; beyond it, pointing at
// the city center is a meaningful question again.
export const AT_CITY_KM = 25;

export function gradeEmoji(diff: number): string {
  if (diff <= 10) return "🎯";
  if (diff <= 25) return "🟢";
  if (diff <= 60) return "🟡";
  if (diff <= 110) return "🟠";
  return "🔴";
}

// A game's final score: total angular error across the 5 cities, 0–900,
// lower is better.
export const scoreOf = (results: CityResult[]): number =>
  Math.round(results.reduce((sum, r) => sum + r.error, 0));

export const SITE_URL = "https://bearing.city/";

// Continental is the canonical daily game, so its share text stays exactly as
// it was pre-modes; only Global gets a label. The continent itself is never
// included — it's derived from the player's location.
export function buildShareText(results: CityResult[], mode: GameMode): string {
  const total = scoreOf(results);
  const emojis = results.map((r) => gradeEmoji(r.error)).join("");
  const label = mode === "global" ? "Bearing (Global)" : "Bearing";
  return `${label} · ${total}° off over ${results.length} cities · ${emojis}\n${SITE_URL}`;
}
