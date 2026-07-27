// Gate for the "phone held vertical" failure mode: players aim the phone like
// a camera, which makes compass headings degenerate near 90° of tilt. The
// game needs the phone roughly flat, like a real compass.

export const TILT_ENTER_DEG = 65; // above this, "too vertical" engages
export const TILT_EXIT_DEG = 50; // below this, it releases (hysteresis)

// Angle in degrees between the screen normal and straight up.
// 0 = flat face-up, 90 = vertical (portrait or landscape), 180 = face-down.
// acos(cos β · cos γ) in the device frame — independent of screen rotation.
export function screenTilt(beta: number, gamma: number): number {
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const c = Math.min(1, Math.max(-1, Math.cos(b) * Math.cos(g)));
  return (Math.acos(c) * 180) / Math.PI;
}

// Hysteresis step: engage at ≥ enter, release at ≤ exit, hold in between.
// The 15° dead band is far above sensor noise, so the gate never flickers
// at the boundary. NaN holds the previous state (both comparisons false).
export function nextTooVertical(prev: boolean, tilt: number): boolean {
  if (tilt >= TILT_ENTER_DEG) return true;
  if (tilt <= TILT_EXIT_DEG) return false;
  return prev;
}
