// Daily-rank meter: a fixed red→green track with a marker at the player's
// standing — right edge is the day's best score, left edge the worst.
// Position is the primary encoding and the caption restates the number, so
// the green/red hue is never the only channel (colorblind-safe); the
// gradient's lightness also rises monotonically left→right.
interface RankBarProps {
  betterThanPct: number; // 0..99, share of players beaten — higher is better
  sampleCount: number;
}

export default function RankBar({ betterThanPct, sampleCount }: RankBarProps) {
  const label = `Better than ${betterThanPct}% of ${sampleCount.toLocaleString()} players today`;
  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-2 -mt-2">
      <div
        role="img"
        aria-label={label}
        className="relative w-full h-2 rounded-full"
        style={{
          background:
            "linear-gradient(to right, #dc2626, #f59e0b, #4ade80)",
        }}
      >
        <div
          className="absolute top-1/2 h-3.5 w-3.5 rounded-full bg-slate-100 border-2 border-slate-900"
          style={{ left: `${betterThanPct}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <p className="text-sm text-slate-400">
        Better than{" "}
        <span className="font-semibold text-slate-100">{betterThanPct}%</span>{" "}
        of {sampleCount.toLocaleString()} players today
      </p>
    </div>
  );
}
