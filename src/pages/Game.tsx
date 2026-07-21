import { useEffect, useMemo, useRef, useState } from "react";
import type { City } from "../lib/cities.ts";
import {
  angularDiff,
  bearingTo,
  buildShareText,
  gradeEmoji,
  type CityResult,
} from "../lib/directions.ts";
import { loadTodayCities, todayKey } from "../lib/today.ts";
import { loadResult, saveResult } from "../lib/storage.ts";
import { declinationAt } from "../lib/declination.ts";
import { track } from "../lib/analytics.ts";
import { isIos, likelyHasCompass } from "../lib/device.ts";
import { useGeolocation } from "../lib/useGeolocation.ts";
import { useCompassHeading } from "../lib/useCompassHeading.ts";
import CompassDial from "../components/CompassDial.tsx";
import ResultsGlobe from "../components/ResultsGlobe.tsx";
import Button from "../components/Button.tsx";

type Phase = "intro" | "permissions" | "playing" | "results";

export default function Game() {
  // A finished game persists for the rest of the day — refreshing shows the
  // results again instead of restarting the puzzle.
  const [saved] = useState(() => loadResult(todayKey()));
  const [phase, setPhase] = useState<Phase>(saved ? "results" : "intro");
  const [cities, setCities] = useState<City[] | null | "loading">("loading");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<CityResult[]>(saved?.results ?? []);
  const [manualAngle, setManualAngle] = useState(0);
  const [reveal, setReveal] = useState<{ guess: number; actual: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  // results-list selection: focus one city's lines on the globe
  const [focus, setFocus] = useState<number | null>(null);

  const geo = useGeolocation();
  const compass = useCompassHeading();
  const dateKey = useRef(todayKey()).current;

  useEffect(() => {
    if (!saved) loadTodayCities().then(setCities);
  }, [saved]);

  const startPermissions = () => {
    // The Play tap is itself a user gesture, so iOS's compass permission
    // prompt can be triggered right here — no separate "Enable compass" tap.
    track("game_start");
    setPhase("permissions");
    if (isIos()) {
      // Serial prompts: motion must be requested inside the tap's gesture
      // window, while the location prompt needs no gesture — so motion goes
      // first and location waits for it to settle instead of stacking two
      // popups on top of each other.
      compass.request().then(() => geo.request());
    } else {
      geo.request();
      compass.request();
    }
  };

  useEffect(() => {
    if (geo.status === "denied" || geo.status === "system_denied") {
      track("geo_denied", { kind: geo.status });
    }
  }, [geo.status]);

  const compassResolved =
    compass.status === "sensor" || compass.status === "manual";
  useEffect(() => {
    if (phase === "permissions" && geo.status === "granted" && compassResolved) {
      setPhase("playing");
    }
  }, [phase, geo.status, compassResolved]);

  const mode = compass.status === "sensor" ? "sensor" : "manual";

  // Convert magnetic headings ("alpha" source, i.e. Android) to true north.
  // iOS's webkitCompassHeading is already true when location is on.
  const declination = useMemo(
    () => (geo.position ? declinationAt(geo.position) : 0),
    [geo.position],
  );
  const trueHeading =
    compass.heading === null
      ? null
      : compass.source === "alpha"
        ? (compass.heading + declination + 360) % 360
        : compass.heading;

  const lockIn = () => {
    if (cities === "loading" || cities === null || !geo.position) return;
    const city = cities[round];
    const guess = mode === "sensor" ? (trueHeading ?? 0) : manualAngle;
    const actual = bearingTo(geo.position, city);
    setResults((prev) => [
      ...prev,
      {
        name: city.name,
        country: city.country,
        lat: city.lat,
        lon: city.lon,
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
      saveResult(dateKey, results, geo.position);
      track("game_complete", {
        score: Math.round(results.reduce((s, r) => s + r.error, 0)),
        mode,
      });
      setPhase("results");
    } else {
      setRound(round + 1);
    }
  };

  const share = async () => {
    const text = buildShareText(results);
    track("share", {
      method: typeof navigator.share === "function" ? "sheet" : "clipboard",
    });
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
          <p className="text-lg text-slate-300">
            {likelyHasCompass() ? (
              <>
                You'll be shown <strong>5 cities</strong>. Point your phone
                toward where you think each one is, then lock in your guess.
                The closer your bearing, the better.
              </>
            ) : (
              <>
                You'll be shown <strong>5 cities</strong>. Drag the compass
                needle toward where you think each one is, then lock in your
                guess. The closer your bearing, the better.
              </>
            )}
          </p>
          <p className="text-sm text-slate-500 max-w-xs">
            {likelyHasCompass() ? (
              <>
                Your browser will ask for your location
                {isIos() ? " and motion access" : ""} — that's how Bearing
                knows each city's true direction and where you're pointing.
                Your location never leaves your device.
              </>
            ) : (
              <>
                Your browser will ask for your location — that's how Bearing
                knows each city's true direction. It never leaves your device.
                No compass here? On a phone you get to physically point. 📱
              </>
            )}
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
          <a
            href="./about.html"
            className="text-sm text-slate-500 underline hover:text-slate-400"
          >
            How directions work: great circles, explained
          </a>
        </div>
      )}

      {phase === "permissions" && (
        <div className="flex flex-col items-center text-center gap-6 max-w-sm my-auto">
          <h2 className="text-2xl font-bold">Before we start</h2>
          {likelyHasCompass() ? (
            <div className="w-full rounded-xl bg-slate-800 p-4 text-left">
              <p className="font-semibold">🧭 Compass</p>
              <p className="text-sm text-slate-400 mt-1">
                {compass.status === "sensor"
                  ? "Compass ready!"
                  : compass.status === "manual"
                    ? "No compass reading — no problem, you'll aim by dragging the dial instead."
                    : "Listening for the compass…"}
              </p>
            </div>
          ) : (
            <div className="w-full rounded-xl bg-slate-800 p-4 text-left">
              <p className="font-semibold">🖱️ No compass needed</p>
              <p className="text-sm text-slate-400 mt-1">
                This device doesn't have a compass, so you'll aim by dragging
                the dial. For the point-your-phone experience, open
                bearing.city on a phone.
              </p>
            </div>
          )}
          <div className="w-full rounded-xl bg-slate-800 p-4 text-left">
            <p className="font-semibold">📍 Location</p>
            <div className="text-sm text-slate-400 mt-1">
              {geo.status === "system_denied" && isIos() ? (
                <>
                  <p>Location is blocked in an iPhone setting. Check both:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1.5">
                    <li>
                      Settings → Privacy & Security → Location Services →
                      Safari Websites — set to <strong>“While Using the App”</strong>
                    </li>
                    <li>
                      Settings → Apps → Safari → Location — set to{" "}
                      <strong>“Ask”</strong> or <strong>“Allow”</strong>
                    </li>
                  </ul>
                  <p className="mt-2">
                    Then tap the button below. (A per-site block in the Page
                    Menu's Website Settings can also cause this.)
                  </p>
                </>
              ) : (
                <p>
                  {geo.status === "granted"
                    ? "Got it!"
                    : geo.status === "requesting"
                      ? "Waiting for your browser's permission prompt…"
                      : geo.status === "system_denied"
                        ? "Location is disabled for your browser or device. Turn it on in your system settings, then try again."
                        : geo.status === "denied"
                          ? isIos()
                            ? "Location was denied. Tap Try again — or close this tab and reopen bearing.city, and Safari will ask again on a fresh visit."
                            : "Permission denied — without your location, Bearing can't compute which way each city is. Allow location for this site (usually the padlock or settings icon in the address bar), then try again."
                          : geo.status === "error"
                            ? "Couldn't get a location fix. If you're indoors or offline, that can take a moment — try again."
                            : "Used only on your device, only to compute city directions."}
                </p>
              )}
            </div>
            {(geo.status === "denied" ||
              geo.status === "system_denied" ||
              geo.status === "error") &&
              (geo.status === "system_denied" && isIos() ? (
                // iOS Safari resolves location authorization once per page
                // load — after a settings change, only a reload helps.
                <Button
                  variant="secondary"
                  className="mt-3 text-sm px-4 py-2"
                  onClick={() => window.location.reload()}
                >
                  Reload and try again
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-3 text-sm px-4 py-2"
                  onClick={geo.request}
                >
                  Try again
                </Button>
              ))}
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
            heading={trueHeading ?? 0}
            manualAngle={manualAngle}
            onManualChange={setManualAngle}
            reveal={reveal}
          />
          {reveal === null ? (
            <>
              {mode === "sensor" &&
              compass.accuracy !== null &&
              (compass.accuracy < 0 || compass.accuracy > 30) ? (
                <p className="text-sm text-amber-400 text-center max-w-xs">
                  🧭 Compass accuracy is low — wave your phone in a figure-8
                  to recalibrate, away from metal and magnets.
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  {mode === "sensor"
                    ? "Point the top of your phone toward the city."
                    : "Drag the dial to aim the needle toward the city."}
                </p>
              )}
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
          <h2 className="text-2xl font-bold">Results</h2>
          <p className="text-5xl font-bold text-amber-400">
            {Math.round(results.reduce((s, r) => s + r.error, 0))}°
          </p>
          <p className="text-slate-400 -mt-4">total error (lower is better)</p>
          {(() => {
            const globePos = geo.position ?? saved?.pos ?? null;
            const hasCoords = results.every((r) => typeof r.lat === "number");
            return globePos && hasCoords ? (
              <ResultsGlobe pos={globePos} results={results} focusIndex={focus} />
            ) : null;
          })()}
          <ul className="w-full rounded-xl bg-slate-800 divide-y divide-slate-700 overflow-hidden">
            {results.map((r, i) => (
              <li key={r.name}>
                <button
                  onClick={() => setFocus(focus === i ? null : i)}
                  aria-pressed={focus === i}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    focus === i
                      ? "bg-slate-700"
                      : focus !== null
                        ? "opacity-50"
                        : ""
                  }`}
                >
                  <span>
                    <span className="text-slate-500 text-sm mr-2">{i + 1}</span>
                    {gradeEmoji(r.error)} {r.name}
                    <span className="text-slate-500 text-sm"> · {r.country}</span>
                  </span>
                  <span className="font-semibold">{Math.round(r.error)}°</span>
                </button>
              </li>
            ))}
          </ul>
          <Button onClick={share}>{copied ? "Copied!" : "Share"}</Button>
          <p className="text-sm text-slate-500 max-w-xs">
            Surprised by a direction? Bearing scores the shortest path over the
            globe, which often differs from the straight line on a flat map —{" "}
            <a
              href="./about.html"
              className="underline text-slate-400 hover:text-slate-300"
            >
              see why, with pictures
            </a>
            .
          </p>
          <p className="text-sm text-slate-500">
            Come back tomorrow for a new set of cities.
          </p>
        </div>
      )}
    </div>
  );
}
