# Plan: Personal Stats, Global Percentile Rankings, and Anonymous Accounts

## Context

Bearing today is a pure static SPA: the only persistence is *today's* result per
mode (`bearing:lastResult:*`, self-expiring at local midnight), so nothing
accumulates — no history, no streaks, no sense of progress. This plan adds:

1. **Personal stats** — streaks, averages, best score, score distribution;
   fully client-side, works offline, no account needed.
2. **Global percentile rankings** — the 80/20 version: players' scores are
   batch-processed into a per-day score distribution, and each player sees
   "Top X% of N players today." No live named leaderboard (friend groups
   deferred).
3. **Anonymous-first accounts** — every player who finishes a game gets an
   anonymous Supabase identity automatically (zero friction); optional email
   magic-link upgrade syncs stats across devices.

The strategic goal is an acquisition story: anonymous IDs + a scores table make
DAU/retention/streak curves *provable* from real data instead of estimated
from analytics events.

**Stack decisions (made):** Supabase (Postgres + auth + RLS) as the first and
only backend; frontend stays a static SPA on GitHub Pages. Percentiles are
batch-computed (pg_cron), not queried live.

### Constraints honored throughout

- All logic lives in tested `src/lib/*.ts` pure modules; `Game.tsx` JSX stays
  dumb (Vitest is node-env, no jsdom — the house pattern).
- Imports carry `.ts`/`.tsx` extensions; strict TS with `verbatimModuleSyntax`.
- Everything degrades gracefully offline / storage unavailable (try/catch
  no-op, like `src/lib/storage.ts`).
- The game never blocks on the network: supabase-js is dynamically imported
  and only touched after a game completes.
- Milestone 1 ships alone even if the backend slips.
- Privacy: coordinates, headings, and city-level location are **never** sent.
  The only location-derived datum that ever leaves the device is the continent
  name (1-of-6 coarse), only in continental mode, because the percentile
  cohort is (date, continent). Copy is updated to say so honestly (§2.8).
  Umami analytics still never receives continent (`analytics.ts` untouched).

---

## Milestone 0 — Shared groundwork

### 0.1 Extract `scoreOf`

In `src/lib/directions.ts`:

```ts
export const scoreOf = (results: CityResult[]): number =>
  Math.round(results.reduce((sum, r) => sum + r.error, 0));
```

Replace the three ad-hoc reductions: `buildShareText` (directions.ts:50),
`game_complete` tracking (Game.tsx:184), results header (Game.tsx:458). Add a
case to `tests/directions.test.ts`.

---

## Milestone 1 — Personal stats (client-only)

### 1.1 New `src/lib/history.ts`

Append-only per-mode history, separate from the self-expiring
`bearing:lastResult:*` keys.

- Key: `bearing:history:${mode}`; value: JSON array sorted ascending by
  `dateKey`.

```ts
export interface HistoryEntry {
  dateKey: string;          // local YYYY-MM-DD, from todayKey()
  score: number;            // scoreOf(results), 0–900
  errors: number[];         // 5 per-city errors, rounded to 0.1
  continent?: Continent;    // continental mode only (stays on-device;
                            // used to re-fetch the right distribution later)
}

export function recordGame(mode: GameMode, entry: HistoryEntry): void;
  // upsert by dateKey — idempotent, replaying a saved day never duplicates
export function loadHistory(mode: GameMode): HistoryEntry[];
  // defensive parse like storage.ts:42-63: validate each entry field-by-field,
  // drop malformed entries (don't nuke the array), return [] on any throw
```

No size cap needed (365 entries/yr ≈ a few KB). One-time backfill: when the
stats UI opens, if `loadResult(mode, todayKey())` exists but history lacks
today, insert today's entry — players who finished today's game before this
update deploys still start with 1 game / streak 1.

### 1.2 New `src/lib/stats.ts` (pure, no storage access)

```ts
export interface ModeStats {
  gamesPlayed: number;
  averageScore: number | null;   // null when gamesPlayed === 0
  bestScore: number | null;
  distribution: number[];        // 5 counts, one per grade tier
}

export function computeModeStats(entries: HistoryEntry[]): ModeStats;

export function computeStreaks(
  dateKeys: string[],            // any order, may contain duplicates
  today: string,                 // todayKey()
): { current: number; max: number };
```

**Streak semantics:**

- Local `YYYY-MM-DD` strings; day arithmetic parses at UTC noon
  (`new Date(`${key}T12:00:00Z`)`) ÷ 86 400 000 — immune to DST off-by-ones.
- `max`: longest run of consecutive dates anywhere in the set.
- `current`: run ending at `today` **or** at yesterday (Wordle-style grace:
  the streak is alive before you've played today; it reads 0 only after a
  full local day is missed).
- **Playing either mode preserves the streak** (union of date keys across
  modes). Games/avg/best/distribution stay per-mode. *(Decision point Q2.)*

**Distribution buckets:** reuse the gradeEmoji tiers applied to average error —
bucket by `gradeEmoji(score / 5)`: 🎯 ≤50 total, 🟢 ≤125, 🟡 ≤300, 🟠 ≤550,
🔴 else. Zero new semantics; the emojis are already the game's visual language;
renders as a clean 5-bar row on mobile.

### 1.3 Stats UI — modal, not a new Phase

New `src/components/StatsModal.tsx`. The `Phase` machine (Game.tsx:27) encodes
game progression; stats must be reachable from both `intro` and `results`
without disturbing game state. First modal in the app — keep it primitive:
fixed inset-0 overlay, `role="dialog" aria-modal="true"`, close on backdrop
click + Escape, Tailwind only, no libraries.

```ts
interface StatsModalProps {
  streaks: { current: number; max: number };
  continental: ModeStats;
  global: ModeStats;
  onClose: () => void;
  // M2 adds: submit toggle; M3 adds: account section
}
```

**Wiring in `src/pages/Game.tsx`:**

- `const [showStats, setShowStats] = useState(false)`; stats computed lazily
  on open (`loadHistory` + `computeModeStats` + `computeStreaks`).
- Intro entry point: "📊 Stats" link beside the about link (Game.tsx:296-301).
- Results entry point: after Share (Game.tsx:492), a `🔥 3-day streak` line +
  "Stats" secondary button — the retention hook at the moment of completion.
- Record history in `nextCity()` beside `saveResult` (Game.tsx:181-188):

```ts
recordGame(gameMode, {
  dateKey, score: scoreOf(results),
  errors: results.map((r) => Math.round(r.error * 10) / 10),
  ...(gameMode === "continental" && geo.position
    ? { continent: detectContinent(geo.position) } : {}),
});
```

### 1.4 Tests

- `tests/history.test.ts` — memory-localStorage via `vi.stubGlobal` (copy the
  pattern from storage.test.ts:6-17): round-trip, upsert idempotency,
  malformed-entry filtering, per-mode isolation.
- `tests/stats.test.ts` — streaks: empty, single day, gap resets,
  played-yesterday grace, month/year boundaries (2026-01-31→02-01,
  2025-12-31→2026-01-01), duplicates, max ≠ current; bucket edges
  (50/125/300/550).

**Milestone 1 ships here.** `deploy.yml` untouched.

---

## Milestone 2 — Supabase: anonymous identity, submission, batch percentiles

### 2.1 Project setup (manual; documented in `supabase/README.md`)

- Create project; enable **Anonymous sign-ins**; keep default anonymous-user
  rate limits (Turnstile captcha is later hardening, don't block on it).
- Enable `pg_cron`.
- All SQL committed as migrations (`supabase/migrations/0001_scores.sql`,
  `0002_distributions.sql`, `0003_cron.sql`) — an acquirer can rebuild the
  backend from the repo. Applied via SQL editor or `supabase db push`; no CI
  involvement, no repo secrets.

### 2.2 Schema

```sql
-- 0001_scores.sql
create table public.scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,                    -- player's LOCAL date (= puzzle identity)
  mode       text not null check (mode in ('continental', 'global')),
  continent  text check (continent in
    ('africa','asia','europe','north-america','oceania','south-america')),
  score      smallint not null check (score between 0 and 900),
  errors     smallint[] not null check (cardinality(errors) = 5),
  input      text check (input in ('sensor', 'manual')),
  created_at timestamptz not null default now(),
  primary key (user_id, date, mode),
  check ((mode = 'global') = (continent is null))
);

alter table public.scores enable row level security;

-- Insert own scores only, only for dates near "now" (local dates worldwide
-- span utc±1 day). No UPDATE/DELETE: scores are immutable — light anti-cheat,
-- and it freezes old distributions.
create policy scores_insert_own on public.scores
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and date between (now() at time zone 'utc')::date - 1
                 and (now() at time zone 'utc')::date + 1
  );

-- Read own rows (powers M3 cross-device restore). No public read.
create policy scores_select_own on public.scores
  for select to authenticated using (auth.uid() = user_id);
```

```sql
-- 0002_distributions.sql
create table public.daily_distributions (
  date         date not null,
  mode         text not null,
  continent    text not null default 'all',   -- 'all' for global mode
  histogram    integer[] not null,            -- 90 counts; bucket i = [i*10, i*10+10), 900 folds into 89
  sample_count integer not null,
  updated_at   timestamptz not null default now(),
  primary key (date, mode, continent)
);

alter table public.daily_distributions enable row level security;
create policy distributions_public_read on public.daily_distributions
  for select to anon, authenticated using (true);

create or replace function public.rebuild_distributions()
returns void
language sql
security definer
set search_path = public
as $$
  insert into daily_distributions (date, mode, continent, histogram, sample_count)
  select g.date, g.mode, g.cont,
         (select array_agg(coalesce(b.cnt, 0) order by gs.bucket)
            from generate_series(0, 89) gs (bucket)
            left join (
              select least(89, score / 10) as bucket, count(*)::int as cnt
                from scores s
               where s.date = g.date and s.mode = g.mode
                 and coalesce(s.continent, 'all') = g.cont
               group by 1
            ) b using (bucket)),
         g.n
    from (select date, mode, coalesce(continent, 'all') as cont, count(*)::int as n
            from scores
           where date between current_date - 1 and current_date + 1
           group by 1, 2, 3) g
  on conflict (date, mode, continent) do update
    set histogram = excluded.histogram,
        sample_count = excluded.sample_count,
        updated_at = now();
$$;
```

```sql
-- 0003_cron.sql
select cron.schedule('rebuild-distributions', '7 * * * *',
                     $$select public.rebuild_distributions()$$);
```

**Batch mechanism: pg_cron inside Supabase.** An Edge Function on cron adds a
Deno toolchain and second deploy surface; GitHub Actions cron would put a
service-role key in repo secrets and couple the backend to CI. pg_cron is one
migration file, lives with the data, and transfers with the Supabase project.

**Freshness:** hourly at :07 gives same-day percentiles. The `current_date ± 1`
window covers all timezones; because RLS rejects inserts outside that window,
older distributions are provably frozen — the job never touches history.

### 2.3 Config — committed constants, mirroring `analytics.ts`

New `src/lib/supabaseConfig.ts`:

```ts
// Supabase URL + anon (publishable) key — public by design, safe to commit.
// RLS is the security boundary. Empty URL keeps the backend fully inert
// (same convention as WEBSITE_ID in analytics.ts).
export const SUPABASE_URL = "";   // set when the project is live
export const SUPABASE_ANON_KEY = "";
```

No Vite env machinery: one deploy target, and analytics.ts:7 already
establishes the committed-public-ID, empty-means-inert precedent. The empty
string is also the rollback kill switch.

### 2.4 New `src/lib/backend.ts` (thin I/O; math lives elsewhere)

Header comment restates the privacy contract in the analytics.ts:3-6 style.

```ts
export interface ScoreSubmission {
  dateKey: string;
  mode: GameMode;
  continent: Continent | null;   // null for global
  score: number;
  errors: number[];              // whole degrees (DB column is smallint[])
  input: "sensor" | "manual";
}
export interface Distribution { histogram: number[]; sampleCount: number }

export function submitScore(sub: ScoreSubmission): void;
  // Fire-and-forget: enqueue to localStorage `bearing:pendingScores`, then
  // flushPending(). Queue survives offline play; entries older than 2 days
  // are dropped (RLS date window would reject them anyway).

export async function fetchDistribution(
  dateKey: string, mode: GameMode, continent: Continent | null,
): Promise<Distribution | null>;   // null on any error / missing row

export function flushPending(): void;  // also called once at idle on app load
```

Implementation notes:

- `@supabase/supabase-js` (new runtime dep) is **dynamically imported** inside
  a memoized `getClient()` — Vite splits it into its own chunk (~35 KB gz);
  the game bundle is untouched and the chunk loads only after a game
  completes (or during magic-link callback in M3).
- Anonymous identity is **lazy**: `getClient()` checks `auth.getSession()`;
  if none, `signInAnonymously()`. A user is minted only when a score is
  actually submitted, so "users" ≈ "players who finished a game" — keeps the
  DAU metric honest. supabase-js persists the session; the same anonymous
  user is reused across days.
- Inserts use `onConflict` ignore — duplicate PK counts as success, dequeue.
- `submitScore` no-ops when submission is disabled (§2.6).

### 2.5 New `src/lib/percentile.ts` (pure, tested)

```ts
export const bucketOf = (score: number): number => Math.min(89, Math.floor(score / 10));

export const MIN_SAMPLE = 20;
// "Top X%": share of players with a better-or-equal score, midpoint
// convention within the player's own bucket. null when sampleCount < MIN_SAMPLE.
export function topPercent(score: number, d: Distribution): number | null;
// better = sum(histogram[0 .. bucketOf(score)-1]); own = histogram[bucketOf(score)];
// pct = clamp(1, 100, round(100 * (better + 0.5 * max(1, own)) / sampleCount))
```

### 2.6 Opt-out pref — new `src/lib/settings.ts`

`bearing:submitScores` (`"on" | "off"`, default **on**), `loadSubmitPref()` /
`saveSubmitPref()` in the `gameMode.ts` style. Toggle rendered in StatsModal:
"Compare my score with other players — only your score and continent are sent,
never your location." Default-on because percentile is the headline feature
and the data is coarse; honesty comes from copy (§2.8), control from this
toggle. *(Decision point Q1.)*

### 2.7 Game.tsx client flow

In `nextCity()` beside `saveResult`/`recordGame`:

```ts
submitScore({
  dateKey, mode: gameMode,
  continent: gameMode === "continental" && geo.position
    ? detectContinent(geo.position) : null,
  score: scoreOf(results),
  errors: results.map((r) => Math.round(r.error)),
  input: inputMode,
});
```

Results screen: `useEffect` on `phase === "results"` calls
`fetchDistribution`, stores `{ topPct, sampleCount } | null`. Continent for
the fetch resolves as `historyEntry.continent ??
detectContinent(geo.position ?? saved.pos)` — `saved.pos` (rounded ~11 km) is
plenty precise for nearest-city continent detection, so a reload later in the
day works without re-requesting location. Render under the score header
(Game.tsx:458-460):

- Distribution present, n ≥ 20: **"Top 12% of 1,432 players today"**.
- Otherwise render nothing (offline, backend inert, early in the day, opted
  out). Optionally a muted "Rankings appear once enough players finish" when
  the fetch succeeded but n < 20.

Also call `flushPending()` once from `main.tsx` at idle
(`requestIdleCallback`/`setTimeout` fallback) so airplane-mode scores from
yesterday get submitted.

### 2.8 Privacy copy updates (required, explicit)

Continent *is* location-derived; the copy gets honest rather than quietly
weakened:

- **Game.tsx:240 and :244-245**: "Your location never leaves your device" →
  "Your precise location never leaves your device — Bearing only ever shares
  your score (and, for the continent game, which continent you're on) so you
  can see how you rank."
- **Game.tsx:364** ("Used only on your device…"): same qualifier.
- **public/about.html**: privacy paragraph updated identically + mentions the
  stats-modal opt-out toggle.
- **README.md**: privacy/stack sections updated (no longer strictly
  "no backend").

### 2.9 Tests & verification

- `tests/percentile.test.ts`: best score in field → 1 (never "Top 0%"),
  worst → 100, uniform-distribution sanity, n < 20 → null, score 900 →
  bucket 89, empty histogram.
- Queue logic in `backend.ts` factored into pure enqueue/dequeue/expiry
  functions, tested in `tests/backend.test.ts` with the memory-storage stub
  (network paths untested — consistent with house style).
- Manual: `npm run dev` → play both modes → inspect `bearing:history:*`;
  `bearing:pendingScores` empties; Supabase table editor shows the `scores`
  row with correct local date/continent → `select rebuild_distributions()`
  manually → seed ~30 synthetic rows via SQL editor → reload results →
  percentile line renders and the n ≥ 20 floor behaves. Kill network
  mid-game → stats still work, no percentile, score queued.
- `deploy.yml` and `gen-days.yml` unchanged (anon key is committed; no
  secrets).

---

## Milestone 3 — Account upgrade (minimal; email magic link, OAuth deferred)

- StatsModal "Save your stats" section: email input →
  `auth.updateUser({ email })` on the **existing anonymous user** → Supabase
  sends a confirmation link → the anon user converts in place to a permanent
  account. Same `user_id`, so all submitted scores stay attached with zero
  data migration.
- Magic-link callback: the link lands on `bearing.city/#access_token=…`;
  supabase-js `detectSessionInUrl` handles it only if the client initializes,
  so in `main.tsx`: if `location.hash` contains `access_token`, eagerly
  `import("./lib/backend.ts")` and init; otherwise stay lazy.
- Second device (`signInWithOtp`): new `restoreHistory()` in backend.ts —
  select own scores (RLS `scores_select_own`), merge into local history by
  union-on-dateKey (existing local entry wins). Accepted, documented
  limitation: scores the second device submitted anonymously *before* signing
  in remain orphaned server-side.
- StatsModal shows account state: "Anonymous — stats saved on this device" /
  "Synced as m***@…". Sign-out can be deferred.

---

## What this proves to an acquirer

From the `scores` table + `auth.users` alone, no extra client work:

- **DAU/WAU/MAU** = distinct `user_id` per window (honest: only finished
  games mint users).
- **Retention cohorts** (D1/D7/D30) via `auth.users.created_at` as first-seen.
- **Engagement depth**: streak distributions, games/user, mode split,
  sensor-vs-manual (`input`), continental mix, sample_count time series.
- Extra artifact worth committing: `supabase/analytics.sql` — 5–6 saved
  queries (DAU, retention triangle, streak histogram) as a ready-made
  data-room artifact. Umami keeps covering top-of-funnel (visit → game_start
  → game_complete conversion).

---

## Sequencing

1. **M0 + M1** (one PR, ships alone): `scoreOf` → `history.ts` → `stats.ts` →
   `StatsModal.tsx` → Game.tsx wiring → tests.
2. **M2** (backend PR): migrations + `supabase/README.md` →
   `supabaseConfig.ts` (empty = inert, so the PR can merge before the project
   is live) → `percentile.ts` → `backend.ts` + queue → results-screen
   percentile → settings toggle → copy updates. Flip the config constants to
   go live.
3. **M3**: email upgrade + restore-merge.

## Open decision points

1. **Submission default** — recommended: on by default with the stats-modal
   opt-out and honest copy. Opt-in would starve the percentile cohort and the
   DAU story.
2. **Streak definition** — recommended: playing either mode preserves the
   streak; per-mode streaks felt punitive for players who try the other mode.
3. **Milestone 3 timing** — recommended: ship the email upgrade in this
   effort; it's small and completes the accounts narrative.

## Critical files

- `src/pages/Game.tsx` — completion hook at 178-192, intro 296-301, results
  454-521, privacy copy 240/244/364
- `src/lib/directions.ts` — `scoreOf` extraction; `CityResult`/`gradeEmoji`
- `src/lib/storage.ts` — defensive-parse pattern to replicate in `history.ts`
- `src/lib/analytics.ts` — privacy-rule comment + committed-public-ID config
  pattern that `backend.ts`/`supabaseConfig.ts` mirror
- `tests/storage.test.ts` — memory-localStorage test pattern
