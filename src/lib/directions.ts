export interface LatLon {
  lat: number;
  lon: number;
}

export interface CityResult {
  name: string;
  country: string;
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

export function gradeEmoji(diff: number): string {
  if (diff <= 10) return "🎯";
  if (diff <= 25) return "🟢";
  if (diff <= 60) return "🟡";
  if (diff <= 110) return "🟠";
  return "🔴";
}

export const SITE_URL = "https://mattdeclaire.github.io/bearing/";

export function buildShareText(dateKey: string, results: CityResult[]): string {
  const total = Math.round(results.reduce((sum, r) => sum + r.error, 0));
  const emojis = results.map((r) => gradeEmoji(r.error)).join("");
  return `Bearing — ${dateKey} · ${total}° off over ${results.length} cities · ${emojis}\n${SITE_URL}`;
}
