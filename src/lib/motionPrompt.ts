// The Play tap fires the geolocation request and iOS's motion-permission
// prompt together, so the geolocation timing used to classify silent denials
// can be contaminated by the motion modal. iOS shows one popup at a time:
// a location denial arriving while the motion prompt is open cannot have come
// from a human, and once it settles the denial clock must restart from that
// moment. This module lets the two hooks share that state.

let pending = false;
let settledAt: number | null = null;

export function markMotionPromptPending(): void {
  pending = true;
}

export function markMotionPromptSettled(): void {
  pending = false;
  settledAt = Date.now();
}

export function motionPromptSnapshot(): {
  pending: boolean;
  settledAt: number | null;
} {
  return { pending, settledAt };
}
