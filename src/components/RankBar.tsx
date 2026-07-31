// Daily-rank meter: a fixed green→red track with a marker at the player's
// percentile — left edge is the day's best score, right edge the worst.
// Position is the primary encoding and the caption restates the number, so
// the green/red hue is never the only channel (colorblind-safe); the
// gradient's lightness also falls monotonically left→right.
interface RankBarProps {
  topPct: number; // 1..100, lower is better
  sampleCount: number;
}

export default function RankBar({ topPct, sampleCount }: RankBarProps) {
  const label = `Top ${topPct}% of ${sampleCount.toLocaleString()} players today`;
  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2 -mt-2">
      <div
        role="img"
        aria-label={label}
        className="relative w-full h-2 rounded-full"
        style={{
          background:
            "linear-gradient(to right, #4ade80, #f59e0b, #dc2626)",
        }}
      >
        <div
          className="absolute top-1/2 h-3.5 w-3.5 rounded-full bg-slate-100 border-2 border-slate-900"
          style={{ left: `${topPct}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <p className="text-sm text-slate-400">
        <span className="font-semibold text-slate-100">Top {topPct}%</span> of{" "}
        {sampleCount.toLocaleString()} players today
      </p>
    </div>
  );
}
