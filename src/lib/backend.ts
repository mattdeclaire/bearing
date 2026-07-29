import type { SupabaseClient } from "@supabase/supabase-js";
import type { Continent } from "./cities.ts";
import type { GameMode } from "./gameMode.ts";
import { loadSubmitPref } from "./settings.ts";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  backendEnabled,
} from "./supabaseConfig.ts";
import { todayKey } from "./today.ts";
import type { Distribution } from "./percentile.ts";
import {
  enqueue,
  loadQueue,
  pruneExpired,
  saveQueue,
  type ScoreSubmission,
} from "./pendingScores.ts";

export type { ScoreSubmission } from "./pendingScores.ts";

// The only network I/O in the app besides Umami and static fetches.
// Privacy rule: the only things ever sent are score, per-city errors, local
// date, mode, input method, and — continental mode only — the continent name
// (coarse, 1-of-6; the percentile cohort is date + continent). Never
// coordinates, headings, city-level location, or anything finer. Umami
// additionally never receives even the continent (see analytics.ts).

// supabase-js (~35 KB gz) is dynamically imported so the game bundle never
// carries or blocks on it — the chunk loads after a game completes.
let clientPromise: Promise<SupabaseClient | null> | null = null;

function getClient(): Promise<SupabaseClient | null> {
  if (!backendEnabled) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js").then(
    ({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
    () => {
      clientPromise = null; // import failed (offline) — retry next call
      return null;
    },
  );
  return clientPromise;
}

// An auth user is minted only here, when a score actually needs submitting —
// so "users who exist" ≈ "players who finished a game", which keeps the DAU
// numbers honest. supabase-js persists the session in localStorage and
// reuses the same anonymous user across days.
async function ensureUserId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signIn, error } = await client.auth.signInAnonymously();
  return error ? null : (signIn.user?.id ?? null);
}

// Fire-and-forget: queue locally, then try to flush. The queue survives
// offline play; flushPending() also runs once at idle on app load.
export function submitScore(sub: ScoreSubmission): void {
  if (!backendEnabled || loadSubmitPref() === "off") return;
  if (sub.mode === "continental" && sub.continent === null) return;
  saveQueue(enqueue(loadQueue(), sub));
  void flushPending();
}

let flushing = false;

export async function flushPending(): Promise<void> {
  if (flushing || !backendEnabled || loadSubmitPref() === "off") return;
  flushing = true;
  try {
    let queue = pruneExpired(loadQueue(), todayKey());
    saveQueue(queue);
    if (queue.length === 0) return;
    const client = await getClient();
    if (!client) return;
    const userId = await ensureUserId(client);
    if (!userId) return;
    for (const sub of [...queue]) {
      const { error } = await client.from("scores").upsert(
        {
          user_id: userId,
          date: sub.dateKey,
          mode: sub.mode,
          continent: sub.continent,
          score: sub.score,
          errors: sub.errors,
          input: sub.input,
        },
        { onConflict: "user_id,date,mode", ignoreDuplicates: true },
      );
      if (error) continue; // transient or rejected — retry on a later flush
      queue = queue.filter(
        (s) => !(s.dateKey === sub.dateKey && s.mode === sub.mode),
      );
      saveQueue(queue);
    }
  } catch {
    // network trouble — everything still queued for next time
  } finally {
    flushing = false;
  }
}

// Reads the day's public score histogram. No auth session needed — the anon
// key alone can read daily_distributions, so looking never mints a user.
export async function fetchDistribution(
  dateKey: string,
  mode: GameMode,
  continent: Continent | null,
): Promise<Distribution | null> {
  try {
    const client = await getClient();
    if (!client) return null;
    const { data, error } = await client
      .from("daily_distributions")
      .select("histogram, sample_count")
      .eq("date", dateKey)
      .eq("mode", mode)
      .eq("continent", continent ?? "all")
      .maybeSingle();
    if (error || !data) return null;
    const { histogram, sample_count } = data as {
      histogram: unknown;
      sample_count: unknown;
    };
    if (
      !Array.isArray(histogram) ||
      !histogram.every((n) => typeof n === "number") ||
      typeof sample_count !== "number"
    ) {
      return null;
    }
    return { histogram: histogram as number[], sampleCount: sample_count };
  } catch {
    return null;
  }
}
