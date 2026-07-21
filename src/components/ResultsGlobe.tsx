import { useEffect, useMemo, useState } from "react";
import type { CityResult, LatLon } from "../lib/directions.ts";
import {
  destinationPoint,
  frontPath,
  globeCenter,
  graticuleRings,
  greatCircleSegments,
  orthoProject,
} from "../lib/orthographic.ts";

const SIZE = 320;
const C = SIZE / 2;
const R = C - 10;
const STUB_DEG = 5; // ~350 mi: length of guess vectors and error wedges

const signedDiff = (a: number, b: number) => {
  const d = ((a - b + 540) % 360) - 180;
  return d === -180 ? 180 : d;
};

type Ring = [number, number][]; // [lon, lat] pairs from land.json

export default function ResultsGlobe({
  pos,
  results,
}: {
  pos: LatLon;
  results: CityResult[];
}) {
  const [land, setLand] = useState<Ring[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("land.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setLand(data as Ring[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const center = useMemo(() => globeCenter(pos, results), [pos, results]);

  const landPath = useMemo(() => {
    if (!land) return null;
    return land
      .map((ring) =>
        frontPath(center, ring.map(([lon, lat]) => ({ lat, lon })), R),
      )
      .join("");
  }, [land, center]);

  const graticulePath = useMemo(
    () => graticuleRings().map((r) => frontPath(center, r, R)).join(""),
    [center],
  );

  const routes = useMemo(
    () =>
      results.map((r) => {
        const runs = greatCircleSegments(center, pos, r, R);
        const diff = signedDiff(r.actual, r.guess);
        const guessTip = orthoProject(
          center,
          destinationPoint(pos, r.guess, STUB_DEG),
          R,
        );
        // Error wedge: fan from the player between guess and actual bearings.
        const arc: string[] = [];
        const steps = Math.max(2, Math.ceil(Math.abs(diff) / 6));
        for (let i = 0; i <= steps; i++) {
          const b = r.guess + (diff * i) / steps;
          const p = orthoProject(center, destinationPoint(pos, b, STUB_DEG), R);
          arc.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
        const player = orthoProject(center, pos, R);
        const wedge = `M${player.x.toFixed(1)},${player.y.toFixed(1)} L${arc.join(" L")} Z`;
        const city = orthoProject(center, r, R);
        return { runs, guessTip, wedge, city, player };
      }),
    [results, center, pos],
  );

  const playerProj = orthoProject(center, pos, R);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-[320px] select-none"
      role="img"
      aria-label="Globe showing your location and the routes to today's five cities"
    >
      <defs>
        <radialGradient id="globe-face" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#1a2436" />
          <stop offset="100%" stopColor="#0b1220" />
        </radialGradient>
        {/* referenced from a group translated to the disc center, so the
            clip circle lives at the origin of that translated space */}
        <clipPath id="globe-clip">
          <circle cx={0} cy={0} r={R} />
        </clipPath>
      </defs>

      <circle cx={C} cy={C} r={R + 5} fill="#1e293b" />
      <circle cx={C} cy={C} r={R} fill="url(#globe-face)" stroke="#334155" strokeWidth={2} />

      <g clipPath="url(#globe-clip)" transform={`translate(${C} ${C})`}>
        <path d={graticulePath} fill="none" stroke="#293548" strokeWidth={1} />
        {landPath && (
          <path
            d={landPath}
            fill="none"
            stroke="#64748b"
            strokeWidth={1.1}
            strokeOpacity={0.85}
          />
        )}

        {routes.map((r, i) => (
          <g key={results[i].name}>
            <path d={r.wedge} fill="#f59e0b" fillOpacity={0.15} />
            {r.runs.map((run, j) => (
              <polyline
                key={j}
                points={run.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                fill="none"
                stroke="#4ade80"
                strokeWidth={run.front ? 2.2 : 1.6}
                strokeOpacity={run.front ? 0.95 : 0.3}
                strokeDasharray={run.front ? undefined : "3 5"}
                strokeLinecap="round"
              />
            ))}
            <line
              x1={r.player.x}
              y1={r.player.y}
              x2={r.guessTip.x}
              y2={r.guessTip.y}
              stroke="#fbbf24"
              strokeWidth={2}
              strokeOpacity={0.7}
              strokeLinecap="round"
            />
          </g>
        ))}

        {routes.map((r, i) =>
          r.city.front ? (
            <g key={results[i].name}>
              <circle cx={r.city.x} cy={r.city.y} r={4} fill="#4ade80" stroke="#0b1220" strokeWidth={1.5} />
              <text
                x={r.city.x}
                y={r.city.y - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="#e2e8f0"
              >
                {i + 1}
              </text>
            </g>
          ) : (
            <g key={results[i].name} opacity={0.4}>
              <circle cx={r.city.x} cy={r.city.y} r={3.5} fill="none" stroke="#4ade80" strokeWidth={1.5} />
              <text
                x={r.city.x}
                y={r.city.y - 8}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="#e2e8f0"
              >
                {i + 1}
              </text>
            </g>
          ),
        )}

        <circle cx={playerProj.x} cy={playerProj.y} r={7} fill="#fbbf24" fillOpacity={0.25} />
        <circle cx={playerProj.x} cy={playerProj.y} r={4} fill="#fbbf24" stroke="#0b1220" strokeWidth={1.5} />
      </g>
    </svg>
  );
}
