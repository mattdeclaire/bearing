import { useCallback, useEffect, useRef, useState } from "react";

export type CompassStatus =
  | "idle"
  | "requesting"
  | "sensor"
  | "manual"
  | "denied";

interface WebkitOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

const needsIosPermission = () =>
  typeof (
    DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    }
  ).requestPermission === "function";

const SENSOR_TIMEOUT_MS = 3000;

export type CompassSource = "webkit" | "alpha";

export function useCompassHeading() {
  const [status, setStatus] = useState<CompassStatus>("idle");
  const [heading, setHeading] = useState<number | null>(null);
  // "webkit" headings are already true-north (iOS corrects via location);
  // "alpha" headings are magnetic and need declination applied by the caller.
  const [source, setSource] = useState<CompassSource | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const listen = useCallback(() => {
    let gotEvent = false;

    const onOrientation = (e: DeviceOrientationEvent) => {
      const webkit = (e as WebkitOrientationEvent).webkitCompassHeading;
      let h: number | null = null;
      let src: CompassSource = "alpha";
      if (typeof webkit === "number" && !Number.isNaN(webkit)) {
        h = webkit;
        src = "webkit";
      } else if (e.alpha !== null) {
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

    setTimeout(() => {
      if (!gotEvent) setStatus("manual");
    }, SENSOR_TIMEOUT_MS);
  }, []);

  const request = useCallback(async () => {
    setStatus("requesting");
    if (needsIosPermission()) {
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
    listen();
  }, [listen]);

  useEffect(() => () => cleanupRef.current?.(), []);

  return {
    status,
    heading,
    source,
    request,
    needsPermissionGesture: needsIosPermission(),
  };
}
