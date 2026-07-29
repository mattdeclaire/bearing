// Score-submission preference. Default on: submitting is what powers the
// "Top X% today" comparison, and only coarse data ever leaves the device
// (see backend.ts). The stats modal renders the opt-out toggle.
const PREF_KEY = "bearing:submitScores";

export type SubmitPref = "on" | "off";

export function loadSubmitPref(): SubmitPref {
  try {
    return localStorage.getItem(PREF_KEY) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

export function saveSubmitPref(pref: SubmitPref): void {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    // storage unavailable — losing the preference is fine
  }
}
