import { useCallback, useRef } from "react";
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

function tickMarks() {
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const major = deg % 90 === 0;
    const len = major ? 16 : 8;
    const rad = (deg * Math.PI) / 180;
    const x1 = C + (R - len) * Math.sin(rad);
    const y1 = C - (R - len) * Math.cos(rad);
    const x2 = C + R * Math.sin(rad);
    const y2 = C - R * Math.cos(rad);
    ticks.push(
      <line
        key={deg}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={major ? "#f8fafc" : "#64748b"}
        strokeWidth={major ? 3 : 1.5}
      />,
    );
  }
  return ticks;
}

const LABELS: [string, number][] = [
  ["N", 0],
  ["E", 90],
  ["S", 180],
  ["W", 270],
];

export default function CompassDial({
  mode,
  heading,
  manualAngle,
  onManualChange,
  reveal,
}: CompassDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

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

  // Sensor mode: rose rotates opposite the device heading so its north tracks
  // real-world north; the needle stays fixed pointing up (where the phone points).
  // Manual mode: rose is static (north up); the needle rotates to the dragged angle.
  const roseRotation = mode === "sensor" ? -heading : 0;
  const needleRotation = mode === "sensor" ? 0 : manualAngle;
  const actualRotation =
    reveal === null
      ? null
      : mode === "sensor"
        ? reveal.actual - heading
        : reveal.actual;

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
      <circle cx={C} cy={C} r={R + 6} fill="#1e293b" />
      <circle cx={C} cy={C} r={R} fill="#0f172a" stroke="#334155" strokeWidth={2} />
      <g
        style={{
          transform: `rotate(${roseRotation}deg)`,
          transformOrigin: "center",
          transition: mode === "sensor" ? "transform 120ms linear" : undefined,
        }}
      >
        {tickMarks()}
        {LABELS.map(([label, deg]) => {
          const rad = (deg * Math.PI) / 180;
          const x = C + (R - 34) * Math.sin(rad);
          const y = C - (R - 34) * Math.cos(rad);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={label === "N" ? "#f87171" : "#94a3b8"}
              fontSize={label === "N" ? 24 : 18}
              fontWeight={700}
              style={{
                transform: `rotate(${-roseRotation}deg)`,
                transformOrigin: `${x}px ${y}px`,
              }}
            >
              {label}
            </text>
          );
        })}
      </g>
      {actualRotation !== null && (
        <g
          style={{
            transform: `rotate(${actualRotation}deg)`,
            transformOrigin: "center",
          }}
        >
          <line
            x1={C}
            y1={C}
            x2={C}
            y2={C - R + 24}
            stroke="#4ade80"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <polygon
            points={`${C},${C - R + 12} ${C - 8},${C - R + 30} ${C + 8},${C - R + 30}`}
            fill="#4ade80"
          />
        </g>
      )}
      <g
        style={{
          transform: `rotate(${needleRotation}deg)`,
          transformOrigin: "center",
        }}
      >
        <line
          x1={C}
          y1={C + 30}
          x2={C}
          y2={C - R + 40}
          stroke="#fbbf24"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <polygon
          points={`${C},${C - R + 26} ${C - 11},${C - R + 50} ${C + 11},${C - R + 50}`}
          fill="#fbbf24"
        />
      </g>
      <circle cx={C} cy={C} r={10} fill="#f8fafc" stroke="#0f172a" strokeWidth={3} />
    </svg>
  );
}
