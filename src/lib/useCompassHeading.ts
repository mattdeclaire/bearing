import { useCallback, useEffect, useRef, useState } from "react";
import { isIos, likelyHasCompass } from "./device.ts";

export type CompassStatus =
  | "idle"
  | "requesting"
  | "sensor"
  | "manual"
  | "denied";

interface WebkitOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

const SENSOR_TIMEOUT_MS = 3000;

export type CompassSource = "webkit" | "alpha";

export function useCompassHeading() {
  const [status, setStatus] = useState<CompassStatus>("idle");
  const [heading, setHeading] = useState<number | null>(null);
  // "webkit" headings are already true-north (iOS corrects via location);
  // "alpha" headings are magnetic and need declination applied by the caller.
  const [source, setSource] = useState<CompassSource | null>(null);
  // iOS reports heading uncertainty in degrees (-1 = uncalibrated); other
  // platforms don't expose accuracy, so it stays null there.
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const listen = useCallback((awaitSensor: boolean) => {
    let gotEvent = false;

    const onOrientation = (e: DeviceOrientationEvent) => {
      const webkit = (e as WebkitOrientationEvent).webkitCompassHeading;
      let h: number | null = null;
      let src: CompassSource = "alpha";
      if (typeof webkit === "number" && !Number.isNaN(webkit)) {
        h = webkit;
        src = "webkit";
        const acc = (e as WebkitOrientationEvent).webkitCompassAccuracy;
        if (typeof acc === "number") setAccuracy(Math.round(acc));
      } else if (e.alpha !== null && e.absolute) {
        // A relative-orientation alpha has an arbitrary zero point — using it
        // would render a convincing compass pointing nowhere. Only absolute
        // (magnetometer-anchored) events count; without them the timeout
        // drops us to the manual dial.
        h = (360 - e.alpha) % 360;
      }
      if (h !== null) {
        gotEvent = true;
        setHeading(h);
        setSource(src);
        setStatus("sensor");
      }
    };

    const hasAbsolute = "ondeviceorientationabsolute" in window;
    const eventName = hasAbsolute
      ? "deviceorientationabsolute"
      : "deviceorientation";
    window.addEventListener(
      eventName,
      onOrientation as EventListener,
      true,
    );
    cleanupRef.current = () =>
      window.removeEventListener(
        eventName,
        onOrientation as EventListener,
        true,
      );

    if (awaitSensor) {
      setTimeout(() => {
        if (!gotEvent) setStatus("manual");
      }, SENSOR_TIMEOUT_MS);
    }
  }, []);

  const request = useCallback(async () => {
    // Devices classified as compass-less resolve to manual instantly — no 3s
    // wait, no iOS-style prompt — but the listener still attaches so unusual
    // hardware (touchscreen laptops with real sensors) can upgrade to sensor
    // mode if orientation events actually arrive.
    if (!likelyHasCompass()) {
      setStatus("manual");
      listen(false);
      return;
    }
    setStatus("requesting");
    if (isIos()) {
      try {
        const result = await (
          DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        if (result !== "granted") {
          setStatus("manual");
          return;
        }
      } catch {
        setStatus("manual");
        return;
      }
    }
    listen(true);
  }, [listen]);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { status, heading, source, accuracy, request };
}
