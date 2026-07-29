import { useEffect } from "react";
import { GRADE_TIERS, type ModeStats } from "../lib/stats.ts";
import type { SubmitPref } from "../lib/settings.ts";
import Button from "./Button.tsx";

interface StatsModalProps {
  streaks: { current: number; max: number };
  continental: ModeStats;
  global: ModeStats;
  // Score-submission opt-out; absent while the backend is inert.
  submit?: { pref: SubmitPref; onToggle: () => void };
  onClose: () => void;
}

function ModeSection({ label, stats }: { label: string; stats: ModeStats }) {
  if (stats.gamesPlayed === 0) return null;
  const maxCount = Math.max(...stats.distribution, 1);
  return (
    <div className="w-full rounded-xl bg-slate-800 p-4 text-left">
      <p className="font-semibold">{label}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {(
          [
            [stats.gamesPlayed, "played"],
            [stats.averageScore !== null ? `${stats.averageScore}°` : "—", "average"],
            [stats.bestScore !== null ? `${stats.bestScore}°` : "—", "best"],
          ] as const
        ).map(([value, label]) => (
          <div key={label}>
            <p className="text-xl font-bold text-amber-400">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {GRADE_TIERS.map((emoji, i) => (
          <div key={emoji} className="flex items-center gap-2 text-sm">
            <span className="w-5">{emoji}</span>
            <div className="flex-1 h-3 rounded bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${(stats.distribution[i] / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-slate-400">
              {stats.distribution[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsModal({
  streaks,
  continental,
  global,
  submit,
  onClose,
}: StatsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const played = continental.gamesPlayed + global.gamesPlayed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your stats"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm max-h-[85dvh] flex-col items-center gap-4 overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center"
      >
        <h2 className="text-2xl font-bold">📊 Your stats</h2>
        {played === 0 ? (
          <p className="text-slate-400">
            No games yet — finish today's puzzle and your stats will start
            here.
          </p>
        ) : (
          <>
            <div className="flex gap-8">
              <div>
                <p className="text-3xl font-bold text-amber-400">
                  🔥 {streaks.current}
                </p>
                <p className="text-xs text-slate-500">day streak</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-400">
                  {streaks.max}
                </p>
                <p className="text-xs text-slate-500">best streak</p>
              </div>
            </div>
            <ModeSection label="My continent" stats={continental} />
            <ModeSection label="Global" stats={global} />
          </>
        )}
        {submit && (
          <label className="flex items-start gap-2 text-left text-sm text-slate-400">
            <input
              type="checkbox"
              checked={submit.pref === "on"}
              onChange={submit.onToggle}
              className="mt-1 accent-amber-400"
            />
            <span>
              Compare my score with other players — only your score and
              continent are sent, never your location.
            </span>
          </label>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
