import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";

interface CompassDialProps {
  mode: "sensor" | "manual";
  heading: number;
  manualAngle: number;
  onManualChange: (angle: number) => void;
  reveal: { guess: number; actual: number } | null;
}

const SIZE = 280;
const C = SIZE / 2;
const R = C - 10;

// Shortest signed rotation from b to a, in (-180, 180].
const signedDiff = (a: number, b: number) => {
  const d = ((a - b + 540) % 360) - 180;
  return d === -180 ? 180 : d;
};

const point = (angle: number, radius: number): [number, number] => {
  const rad = (angle * Math.PI) / 180;
  return [C + radius * Math.sin(rad), C - radius * Math.cos(rad)];
};

// Uniform ticks only — no cardinal labels, no distinguishable "north" tick.
// Players must rely on their own sense of direction.
function tickMarks() {
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const [x1, y1] = point(deg, R - 10);
    const [x2, y2] = point(deg, R);
    ticks.push(
      <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth={2} />,
    );
  }
  return ticks;
}

function errorWedge(guessAngle: number, diff: number) {
  if (Math.abs(diff) < 0.5) return null;
  const wedgeR = R - 18;
  const [gx, gy] = point(guessAngle, wedgeR);
  const [ax, ay] = point(guessAngle + diff, wedgeR);
  const sweep = diff > 0 ? 1 : 0;
  return (
    <path
      d={`M ${C} ${C} L ${gx} ${gy} A ${wedgeR} ${wedgeR} 0 0 ${sweep} ${ax} ${ay} Z`}
      fill="#4ade80"
      fillOpacity={0.14}
      stroke="#4ade80"
      strokeOpacity={0.35}
      strokeWidth={1}
    />
  );
}

function Needle({ angle }: { angle: number }) {
  return (
    <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "center" }}>
      {/* tail: slate kite half pointing away from the guess */}
      <polygon
        points={`${C - 13},${C} ${C + 13},${C} ${C},${C + 58}`}
        fill="url(#needle-tail)"
        stroke="#0f172a"
        strokeWidth={1}
      />
      {/* head: amber kite half pointing at the guess */}
      <polygon
        points={`${C},${C - R + 24} ${C - 13},${C} ${C + 13},${C}`}
        fill="url(#needle-head)"
        stroke="#0f172a"
        strokeWidth={1}
      />
      {/* spine highlight */}
      <line
        x1={C}
        y1={C - R + 28}
        x2={C}
        y2={C + 52}
        stroke="#f8fafc"
        strokeOpacity={0.28}
        strokeWidth={1.5}
      />
    </g>
  );
}

export default function CompassDial({
  mode,
  heading,
  manualAngle,
  onManualChange,
  reveal,
}: CompassDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const roseRef = useRef<SVGGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const dragging = useRef(false);

  const frozen = reveal !== null;

  // Sensor headings arrive at uneven rates, so binding the rose straight to
  // them (or tweening each discrete update with a CSS transition) looks jaggy
  // and spins the long way when the heading wraps past 0°. Instead a rAF loop
  // eases a displayed angle toward the live heading along the shortest arc
  // every frame, writing the transform directly so React isn't re-rendered
  // 60 times a second.
  const headingRef = useRef(heading);
  headingRef.current = heading;
  const displayRef = useRef(heading);

  useEffect(() => {
    const el = roseRef.current;
    if (!el) return;
    if (mode !== "sensor") {
      el.style.transform = "rotate(0deg)";
      return;
    }
    let raf = requestAnimationFrame(function tick() {
      const d = signedDiff(headingRef.current, displayRef.current);
      displayRef.current =
        Math.abs(d) < 0.05
          ? headingRef.current
          : (displayRef.current + d * 0.15 + 360) % 360;
      const t = `rotate(${-displayRef.current}deg)`;
      el.style.transform = t;
      // The reveal tableau shares the rose's world rotation so the true-
      // direction arrow keeps pointing at the real city as the phone turns.
      if (worldRef.current) worldRef.current.style.transform = t;
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const angleFromEvent = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    return (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (mode !== "manual" || reveal) return;
    dragging.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    onManualChange(angleFromEvent(e));
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    onManualChange(angleFromEvent(e));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  // While guessing, sensor mode spins the rose opposite the live heading and
  // the needle points up (where the phone points). On reveal the guess needle,
  // true-direction arrow, and error wedge are drawn at their absolute world
  // bearings inside a group that keeps rotating with the live heading — so the
  // green arrow stays pointed at the real city as the player turns, and the
  // wedge between guess and truth rides along unchanged. Manual mode has no
  // live heading; its world group is static.
  const guessNeedleAngle = mode === "sensor" ? 0 : manualAngle;
  const diff = frozen ? signedDiff(reveal.actual, reveal.guess) : 0;
  // Initial world rotation for the frame the reveal mounts on; the rAF loop
  // takes over on the next tick.
  const worldRotation = mode === "sensor" ? -displayRef.current : 0;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-[280px] touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <linearGradient id="needle-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="needle-tail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <radialGradient id="dial-face" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#1a2436" />
          <stop offset="100%" stopColor="#0b1220" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={R + 6} fill="#1e293b" />
      <circle cx={C} cy={C} r={R} fill="url(#dial-face)" stroke="#334155" strokeWidth={2} />
      <circle cx={C} cy={C} r={R - 14} fill="none" stroke="#334155" strokeWidth={1} strokeOpacity={0.6} />

      <g ref={roseRef} data-rose style={{ transformOrigin: "center" }}>
        {tickMarks()}
      </g>

      {frozen ? (
        <g
          ref={worldRef}
          data-world
          style={{ transform: `rotate(${worldRotation}deg)`, transformOrigin: "center" }}
        >
          {errorWedge(reveal.guess, diff)}
          <g style={{ transform: `rotate(${reveal.actual}deg)`, transformOrigin: "center" }}>
            <line
              x1={C}
              y1={C}
              x2={C}
              y2={C - R + 26}
              stroke="#4ade80"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="2 6"
            />
            <polygon
              points={`${C},${C - R + 12} ${C - 8},${C - R + 32} ${C + 8},${C - R + 32}`}
              fill="#4ade80"
            />
          </g>
          <Needle angle={reveal.guess} />
        </g>
      ) : (
        <Needle angle={guessNeedleAngle} />
      )}

      {/* hub */}
      <circle cx={C} cy={C} r={13} fill="#1e293b" stroke="#64748b" strokeWidth={2} />
      <circle cx={C} cy={C} r={5} fill="#fbbf24" />
    </svg>
  );
}
