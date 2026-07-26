export type GameMode = "continental" | "global";

const PREF_KEY = "bearing:gameMode";

export function loadModePref(): GameMode | null {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw === "continental" || raw === "global" ? raw : null;
  } catch {
    return null;
  }
}

export function saveModePref(mode: GameMode): void {
  try {
    localStorage.setItem(PREF_KEY, mode);
  } catch {
    // storage unavailable — losing the preference is fine
  }
}
