import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { CityResult, LatLon } from "../lib/directions.ts";
import {
  applyDrag,
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
const STUB_DEG = 14.5; // ~1000 mi: length of guess vectors and error wedges
const DEG_PER_PX = 0.45; // drag sensitivity (radius 150px ≈ 90° of arc)
const FRICTION = 0.95; // momentum decay per frame
const MIN_SPIN = 0.05; // °/frame below which momentum stops
const AUTO_SPIN = 0.04; // °/frame idle rotation (≈2.4°/s)

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
  // null = the computed smart default view; set once the globe moves
  const [view, setView] = useState<LatLon | null>(null);
  // idle rotation runs until the user grabs the globe; recenter restarts it
  const [autoSpin, setAutoSpin] = useState(true);
  const [userMoved, setUserMoved] = useState(false);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0, t: 0 });
  const velocity = useRef({ dx: 0, dy: 0 });
  const momentumRaf = useRef(0);

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
      cancelAnimationFrame(momentumRaf.current);
    };
  }, []);

  const smartCenter = useMemo(() => globeCenter(pos, results), [pos, results]);
  const center = view ?? smartCenter;

  useEffect(() => {
    if (!autoSpin) return;
    let raf = requestAnimationFrame(function tick() {
      setView((v) => {
        const cur = v ?? smartCenter;
        return {
          lat: cur.lat,
          lon: ((cur.lon + AUTO_SPIN + 540) % 360) - 180,
        };
      });
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [autoSpin, smartCenter]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    cancelAnimationFrame(momentumRaf.current);
    setAutoSpin(false);
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    velocity.current = { dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    const now = performance.now();
    const dt = Math.max(1, now - last.current.t);
    // per-frame (~16ms) velocity for the momentum flick
    velocity.current = { dx: (dx / dt) * 16, dy: (dy / dt) * 16 };
    last.current = { x: e.clientX, y: e.clientY, t: now };
    setUserMoved(true);
    setView((v) => applyDrag(v ?? smartCenter, dx, dy, DEG_PER_PX));
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const spin = () => {
      velocity.current.dx *= FRICTION;
      velocity.current.dy *= FRICTION;
      const { dx, dy } = velocity.current;
      if (
        Math.abs(dx * DEG_PER_PX) < MIN_SPIN &&
        Math.abs(dy * DEG_PER_PX) < MIN_SPIN
      ) {
        return;
      }
      setView((v) => applyDrag(v ?? smartCenter, dx, dy, DEG_PER_PX));
      momentumRaf.current = requestAnimationFrame(spin);
    };
    momentumRaf.current = requestAnimationFrame(spin);
  };

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
    <div className="relative w-full max-w-[320px]">
      {userMoved && (
        <button
          onClick={() => {
            cancelAnimationFrame(momentumRaf.current);
            setView(null);
            setUserMoved(false);
            setAutoSpin(true);
          }}
          aria-label="Recenter globe"
          className="absolute top-1 right-1 z-10 rounded-full bg-slate-800/80 text-slate-300 hover:text-slate-100 w-8 h-8 text-lg leading-none"
        >
          ↺
        </button>
      )}
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full select-none touch-none cursor-grab active:cursor-grabbing"
      role="img"
      aria-label="Globe showing your location and the routes to today's five cities"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
            <path
              d={r.wedge}
              fill="#f59e0b"
              fillOpacity={r.player.front ? 0.15 : 0.05}
            />
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
              strokeOpacity={r.player.front ? 0.7 : 0.2}
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

        <g opacity={playerProj.front ? 1 : 0.3}>
          <circle cx={playerProj.x} cy={playerProj.y} r={7} fill="#fbbf24" fillOpacity={0.25} />
          <circle cx={playerProj.x} cy={playerProj.y} r={4} fill="#fbbf24" stroke="#0b1220" strokeWidth={1.5} />
        </g>
      </g>
    </svg>
    </div>
  );
}
