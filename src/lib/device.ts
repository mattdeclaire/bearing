// No web API reports magnetometer presence directly — the orientation events
// exist on desktops too, they just never fire with data. So classify up front:
// iOS's gesture-gated permission API only exists on devices with a compass,
// and a touch-capable mobile UA almost certainly has one. Everything else is
// treated as compass-less (the sensor listener stays attached regardless, so
// unusual hardware can still upgrade to sensor mode if events arrive).

export function isIos(): boolean {
  return (
    typeof (
      globalThis.DeviceOrientationEvent as unknown as
        | { requestPermission?: () => Promise<string> }
        | undefined
    )?.requestPermission === "function"
  );
}

export function likelyHasCompass(): boolean {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  if (isIos()) return true;
  const touch =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
  const mobileUA = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return touch && mobileUA;
}
