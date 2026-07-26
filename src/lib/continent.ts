import { CITIES, type Continent } from "./cities.ts";
import type { LatLon } from "./directions.ts";

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Haversine central angle — only compared for magnitude, so no Earth radius.
function centralAngle(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lon - a.lon);
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Nearest tagged city decides the continent. No polygon data needed, and it
// degrades gracefully: a player at sea or on a small island simply gets the
// puzzle of whichever coast is closest.
export function detectContinent(pos: LatLon): Continent {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const city of CITIES) {
    const d = centralAngle(pos, city);
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  return best.continent;
}
