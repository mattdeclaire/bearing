import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// One-time generator for public/land.json: world coastlines as plain rings of
// [lon, lat] pairs, simplified for a ~300px globe. world-atlas and
// topojson-client are dev-time only — the client fetches the baked JSON.

const require = createRequire(import.meta.url);
const topoPath = require.resolve("world-atlas/land-110m.json");
const topology = JSON.parse(readFileSync(topoPath, "utf8")) as Topology<{
  land: GeometryCollection;
}>;

const land = feature(topology, topology.objects.land);
const features = "features" in land ? land.features : [land];

const rings: number[][][] = [];
for (const f of features) {
  const geom = f.geometry;
  const polys =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  for (const poly of polys) {
    for (const ring of poly) {
      if (ring.length < 8) continue; // drop specks
      rings.push(ring.map(([lon, lat]: number[]) => [
        Math.round(lon * 10) / 10,
        Math.round(lat * 10) / 10,
      ]));
    }
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "land.json");
writeFileSync(out, JSON.stringify(rings));
console.log(`gen-land: wrote ${rings.length} rings, ${(JSON.stringify(rings).length / 1024).toFixed(0)} KB`);
