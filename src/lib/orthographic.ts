import { bearingTo } from "./directions.ts";
import type { CityResult, LatLon } from "./directions.ts";

// Orthographic projection helpers for the results globe. Angles in degrees.

const D = Math.PI / 180;

export interface Projected {
  x: number;
  y: number;
  front: boolean;
}

export function orthoProject(
  center: LatLon,
  p: LatLon,
  radius: number,
): Projected {
  const phi = p.lat * D;
  const lam = (p.lon - center.lon) * D;
  const phi0 = center.lat * D;
  const cosc =
    Math.sin(phi0) * Math.sin(phi) +
    Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  return {
    x: radius * Math.cos(phi) * Math.sin(lam),
    y: -radius *
      (Math.cos(phi0) * Math.sin(phi) -
        Math.sin(phi0) * Math.cos(phi) * Math.cos(lam)),
    front: cosc >= 0,
  };
}

const toVec = (p: LatLon): [number, number, number] => [
  Math.cos(p.lat * D) * Math.cos(p.lon * D),
  Math.cos(p.lat * D) * Math.sin(p.lon * D),
  Math.sin(p.lat * D),
];
const toLatLon = (v: [number, number, number]): LatLon => ({
  lat: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
  lon: Math.atan2(v[1], v[0]) / D,
});

export function greatCirclePoints(a: LatLon, b: LatLon, n = 96): LatLon[] {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-9) return [a, b];
  const pts: LatLon[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    pts.push(
      toLatLon([
        s1 * va[0] + s2 * vb[0],
        s1 * va[1] + s2 * vb[1],
        s1 * va[2] + s2 * vb[2],
      ]),
    );
  }
  return pts;
}

// Great-circle route split into runs of consecutive same-hemisphere projected
// points, so the front runs render solid and the back runs render dotted.
export interface Run {
  front: boolean;
  points: { x: number; y: number }[];
}

export function greatCircleSegments(
  center: LatLon,
  from: LatLon,
  to: LatLon,
  radius: number,
): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  for (const p of greatCirclePoints(from, to)) {
    const proj = orthoProject(center, p, radius);
    if (!current || current.front !== proj.front) {
      current = { front: proj.front, points: [] };
      runs.push(current);
    }
    current.points.push({ x: proj.x, y: proj.y });
  }
  return runs.filter((r) => r.points.length > 1);
}

// Front-hemisphere-only SVG path for a polyline of lat/lon points, with the
// pen lifted across back-side gaps. Used for the graticule and coastlines.
export function frontPath(
  center: LatLon,
  ring: LatLon[],
  radius: number,
): string {
  let d = "";
  let pen = false;
  for (const p of ring) {
    const proj = orthoProject(center, p, radius);
    if (!proj.front) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${proj.x.toFixed(1)},${proj.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function graticuleRings(): LatLon[][] {
  const rings: LatLon[][] = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const m: LatLon[] = [];
    for (let lat = -90; lat <= 90; lat += 3) m.push({ lat, lon });
    rings.push(m);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const p: LatLon[] = [];
    for (let lon = -180; lon <= 180; lon += 3) p.push({ lat, lon });
    rings.push(p);
  }
  return rings;
}

// Destination point: start at `from`, travel `angularDeg` degrees of arc along
// initial bearing `bearingDeg`. Standard great-circle destination formula.
export function destinationPoint(
  from: LatLon,
  bearingDeg: number,
  angularDeg: number,
): LatLon {
  const phi1 = from.lat * D;
  const lam1 = from.lon * D;
  const theta = bearingDeg * D;
  const delta = angularDeg * D;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );
  return { lat: phi2 / D, lon: ((lam2 / D + 540) % 360) - 180 };
}

// Central angle between two points, degrees [0, 180].
export function angularDistance(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * D;
  const dLon = (b.lon - a.lon) * D;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * D) * Math.cos(b.lat * D) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / D;
}

// View center: keep the player's longitude (player stays on the vertical
// centerline, north up) but tilt the latitude toward where the routes
// actually travel. City latitude is misleading — from the US, Jakarta sits
// south of the equator but the route to it goes north over the pole — so the
// tilt is the average north–south component of each route's midpoint:
// (distance / 2) · cos(initial bearing). Clamped so the player stays at
// least 45° from the horizon.
const MAX_TILT_DEG = 45;

export function globeCenter(pos: LatLon, results: CityResult[]): LatLon {
  const withCoords = results.filter(
    (r) => typeof r.lat === "number" && typeof r.lon === "number",
  );
  if (withCoords.length === 0) return pos;
  const sum = withCoords.reduce(
    (s, r) =>
      s +
      (angularDistance(pos, r) / 2) * Math.cos(bearingTo(pos, r) * D),
    0,
  );
  const tilt = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, sum / withCoords.length),
  );
  return { lat: Math.max(-89, Math.min(89, pos.lat + tilt)), lon: pos.lon };
}
