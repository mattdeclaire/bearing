import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTINENTS, type Continent } from "./cities.ts";
import { SITE_URL } from "./directions.ts";
import type { GameMode } from "./gameMode.ts";
import { mergeHistory, type HistoryEntry } from "./history.ts";
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

// --- Account upgrade (email magic link) ---------------------------------
// The anonymous user is converted IN PLACE by updateUser({ email }): same
// user_id before and after, so every submitted score stays attached with no
// data migration. Until the emailed link is clicked the user stays
// anonymous with the address pending.

export type AccountState =
  | { kind: "none" } // backend inert, offline, or no session yet
  | { kind: "anonymous"; pendingEmail: string | null }
  | { kind: "linked"; email: string };

export async function getAccountState(): Promise<AccountState> {
  try {
    const client = await getClient();
    if (!client) return { kind: "none" };
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user) return { kind: "anonymous", pendingEmail: null };
    if (user.is_anonymous) {
      return { kind: "anonymous", pendingEmail: user.new_email ?? null };
    }
    return { kind: "linked", email: user.email ?? "" };
  } catch {
    return { kind: "none" };
  }
}

export interface LinkResult {
  ok: boolean;
  message: string;
}

const OFFLINE: LinkResult = {
  ok: false,
  message: "Couldn't reach the server — try again later.",
};

export async function linkEmail(email: string): Promise<LinkResult> {
  try {
    const client = await getClient();
    if (!client) return OFFLINE;
    // A player who never submitted a score has no user yet — explicitly
    // creating an account is the one other action that mints one.
    if (!(await ensureUserId(client))) return OFFLINE;
    const { error } = await client.auth.updateUser(
      { email },
      { emailRedirectTo: SITE_URL },
    );
    if (!error) {
      return { ok: true, message: `Check ${email} for a confirmation link.` };
    }
    if (error.code === "email_exists" || /already|registered/i.test(error.message)) {
      // The address already has a Bearing account — send a sign-in link to
      // it instead. Clicking it replaces this device's anonymous session;
      // scores this device submitted anonymously before stay orphaned
      // server-side (accepted limitation, see supabase/README.md).
      const { error: otpError } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: SITE_URL },
      });
      return otpError
        ? { ok: false, message: otpError.message }
        : {
            ok: true,
            message: `That email already has stats — check ${email} for a sign-in link.`,
          };
    }
    return { ok: false, message: error.message };
  } catch {
    return OFFLINE;
  }
}

// One score row from the server → a local history entry. Exported for tests.
export function parseScoreRow(
  row: unknown,
): { mode: GameMode; entry: HistoryEntry } | null {
  if (typeof row !== "object" || row === null) return null;
  const { date, mode, continent, score, errors } = row as Record<
    string,
    unknown
  >;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (mode !== "continental" && mode !== "global") return null;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (
    !Array.isArray(errors) ||
    errors.length !== 5 ||
    !errors.every((e) => typeof e === "number" && Number.isFinite(e))
  ) {
    return null;
  }
  const entry: HistoryEntry = { dateKey: date, score, errors: errors as number[] };
  if (
    typeof continent === "string" &&
    (CONTINENTS as readonly string[]).includes(continent)
  ) {
    entry.continent = continent as Continent;
  }
  return { mode, entry };
}

// supabase-js persists its session under sb-<ref>-auth-token. Checking for
// the key's existence (not its format) lets the idle-time restore below skip
// initializing the client — and downloading its chunk — for the majority of
// visitors who have no session at all.
function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
  } catch {
    return false;
  }
}

// On a device signed into a linked account, pull the account's scores into
// local history (local entries win). Runs at idle on every load so devices
// stay passively in sync. Returns how many days were added.
export async function restoreHistoryIfLinked(): Promise<number> {
  try {
    if (!hasStoredSession()) return 0;
    const client = await getClient();
    if (!client) return 0;
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user || user.is_anonymous) return 0;
    const { data: rows, error } = await client
      .from("scores")
      .select("date, mode, continent, score, errors");
    if (error || !Array.isArray(rows)) return 0;
    const parsed = rows
      .map(parseScoreRow)
      .filter((r): r is NonNullable<typeof r> => r !== null);
    let added = 0;
    for (const mode of ["continental", "global"] as const) {
      added += mergeHistory(
        mode,
        parsed.filter((r) => r.mode === mode).map((r) => r.entry),
      );
    }
    return added;
  } catch {
    return 0;
  }
}

// Returning from a magic link (URL hash carries the tokens): initialize the
// client right away so supabase-js can pick the session out of the URL —
// its detectSessionInUrl only works if the client exists during load — then
// pull the account's history onto this device.
export async function handleAuthCallback(): Promise<void> {
  const client = await getClient();
  if (!client) return;
  await client.auth.getSession(); // waits for the hash to be processed
  await restoreHistoryIfLinked();
}
