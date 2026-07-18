import geomagnetism from "geomagnetism";
import type { LatLon } from "./directions.ts";

// Magnetic declination (degrees, east-positive) at a position, from the World
// Magnetic Model. true heading = magnetic heading + declination.
export function declinationAt(pos: LatLon, date: Date = new Date()): number {
  try {
    return geomagnetism.model(date, { allowOutOfBoundsModel: true }).point([
      pos.lat,
      pos.lon,
    ]).decl;
  } catch {
    return 0;
  }
}
