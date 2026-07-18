import { useEffect, useRef, useState } from "react";
import type { City } from "../lib/cities.ts";
import {
  angularDiff,
  bearingTo,
  buildShareText,
  gradeEmoji,
  type CityResult,
} from "../lib/directions.ts";
import { loadTodayCities, todayKey } from "../lib/today.ts";
import { useGeolocation } from "../lib/useGeolocation.ts";
import { useCompassHeading } from "../lib/useCompassHeading.ts";
import CompassDial from "../components/CompassDial.tsx";
import Button from "../components/Button.tsx";

type Phase = "intro" | "permissions" | "playing" | "results";

export default function Game() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [cities, setCities] = useState<City[] | null | "loading">("loading");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<CityResult[]>([]);
  const [manualAngle, setManualAngle] = useState(0);
  const [reveal, setReveal] = useState<{ guess: number; actual: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const geo = useGeolocation();
  const compass = useCompassHeading();
  const dateKey = useRef(todayKey()).current;

  useEffect(() => {
    loadTodayCities().then(setCities);
  }, []);

  const startPermissions = () => {
    setPhase("permissions");
    geo.request();
    if (!compass.needsPermissionGesture) compass.request();
  };

  const compassResolved =
    compass.status === "sensor" || compass.status === "manual";
  useEffect(() => {
    if (phase === "permissions" && geo.status === "granted" && compassResolved) {
      setPhase("playing");
    }
  }, [phase, geo.status, compassResolved]);

  const mode = compass.status === "sensor" ? "sensor" : "manual";

  const lockIn = () => {
    if (cities === "loading" || cities === null || !geo.position) return;
    const city = cities[round];
    const guess = mode === "sensor" ? (compass.heading ?? 0) : manualAngle;
    const actual = bearingTo(geo.position, city);
    setResults((prev) => [
      ...prev,
      {
        name: city.name,
        country: city.country,
        guess,
        actual,
        error: angularDiff(guess, actual),
      },
    ]);
    setReveal({ guess, actual });
  };

  const nextCity = () => {
    setReveal(null);
    setManualAngle(0);
    if (round + 1 >= 5) {
      setPhase("results");
    } else {
      setRound(round + 1);
    }
  };

  const share = async () => {
    const text = buildShareText(dateKey, results);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to clipboard (user may have cancelled — copying is harmless)
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100 flex flex-col items-center px-4 py-8">
      {phase === "intro" && (
        <div className="flex flex-col items-center text-center gap-6 max-w-sm my-auto">
          <h1 className="text-5xl font-bold tracking-tight">
            🧭 Bearing
          </h1>
          <p className="text-slate-400">{dateKey}</p>
          <p className="text-lg text-slate-300">
            You'll be shown <strong>5 cities</strong>. Point your phone toward
            where you think each one is, then lock in your guess. The closer
            your bearing, the lower your score.
          </p>
          {cities === null ? (
            <p className="text-amber-400">
              No puzzle today — check back soon.
            </p>
          ) : (
            <Button onClick={startPermissions} disabled={cities === "loading"}>
              {cities === "loading" ? "Loading…" : "Play"}
            </Button>
          )}
        </div>
      )}

      {phase === "permissions" && (
        <div className="flex flex-col items-center text-center gap-6 max-w-sm my-auto">
          <h2 className="text-2xl font-bold">Before we start</h2>
          <div className="w-full rounded-xl bg-slate-800 p-4 text-left">
            <p className="font-semibold">📍 Location</p>
            <p className="text-sm text-slate-400 mt-1">
              {geo.status === "granted"
                ? "Got it!"
                : geo.status === "requesting"
                  ? "Waiting for permission…"
                  : geo.status === "denied"
                    ? "Permission denied. Bearing needs your location to know which way each city is."
                    : geo.status === "error"
                      ? "Couldn't get your location."
                      : "Needed to compute the true direction of each city."}
            </p>
            {(geo.status === "denied" || geo.status === "error") && (
              <Button
                variant="secondary"
                className="mt-3 text-sm px-4 py-2"
                onClick={geo.request}
              >
                Try again
              </Button>
            )}
          </div>
          <div className="w-full rounded-xl bg-slate-800 p-4 text-left">
            <p className="font-semibold">🧭 Compass</p>
            <p className="text-sm text-slate-400 mt-1">
              {compass.status === "sensor"
                ? "Compass ready!"
                : compass.status === "manual"
                  ? "No compass found — you'll aim by dragging the dial instead."
                  : compass.status === "requesting"
                    ? "Listening for the compass…"
                    : "Lets you aim by physically pointing your phone."}
            </p>
            {compass.status === "idle" && compass.needsPermissionGesture && (
              <Button
                variant="secondary"
                className="mt-3 text-sm px-4 py-2"
                onClick={compass.request}
              >
                Enable compass
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "playing" && cities !== "loading" && cities !== null && (
        <div className="flex flex-col items-center gap-5 w-full max-w-sm my-auto">
          <p className="text-slate-400 text-sm tracking-widest uppercase">
            City {round + 1} of 5
          </p>
          <div className="text-center">
            <h2 className="text-3xl font-bold">{cities[round].name}</h2>
            <p className="text-slate-400 text-lg">{cities[round].country}</p>
          </div>
          <CompassDial
            mode={mode}
            heading={compass.heading ?? 0}
            manualAngle={manualAngle}
            onManualChange={setManualAngle}
            reveal={reveal}
          />
          {reveal === null ? (
            <>
              <p className="text-sm text-slate-500">
                {mode === "sensor"
                  ? "Point the top of your phone toward the city."
                  : "Drag the dial to aim the needle toward the city."}
              </p>
              <Button onClick={lockIn}>Lock in</Button>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold">
                {gradeEmoji(angularDiff(reveal.guess, reveal.actual))}{" "}
                {Math.round(angularDiff(reveal.guess, reveal.actual))}° off
              </p>
              <Button onClick={nextCity}>
                {round + 1 >= 5 ? "See results" : "Next city"}
              </Button>
            </>
          )}
        </div>
      )}

      {phase === "results" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-sm my-auto">
          <h2 className="text-2xl font-bold">Results — {dateKey}</h2>
          <p className="text-5xl font-bold text-amber-400">
            {Math.round(results.reduce((s, r) => s + r.error, 0))}°
          </p>
          <p className="text-slate-400 -mt-4">total error (lower is better)</p>
          <ul className="w-full rounded-xl bg-slate-800 divide-y divide-slate-700">
            {results.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between px-4 py-3"
              >
                <span>
                  {gradeEmoji(r.error)} {r.name}
                  <span className="text-slate-500 text-sm"> · {r.country}</span>
                </span>
                <span className="font-semibold">{Math.round(r.error)}°</span>
              </li>
            ))}
          </ul>
          <Button onClick={share}>{copied ? "Copied!" : "Share"}</Button>
          <p className="text-sm text-slate-500">
            Come back tomorrow for a new set of cities.
          </p>
        </div>
      )}
    </div>
  );
}
