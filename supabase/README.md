# Bearing's Supabase backend

The only backend Bearing has: anonymous identities, score submission, and
batch-computed daily score distributions for the "Top X% of N players today"
line on the results screen. The frontend stays a static SPA — it talks to
Supabase directly with the public anon key; row-level security is the entire
security boundary.

The client code is **inert until configured**: with `SUPABASE_URL` empty in
`src/lib/supabaseConfig.ts`, nothing is ever submitted or fetched. That's
also the rollback switch.

## One-time setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Auth → Sign In / Providers → Anonymous sign-ins**: enable. Leave the
   default anonymous rate limits on. (Turnstile captcha is optional later
   hardening.) Keep the **Email** provider enabled (it is by default) — the
   "save your stats" upgrade sends magic links through it.
3. **Auth → URL Configuration**: set the Site URL to `https://bearing.city/`
   so confirmation and sign-in links land back on the game.
4. **Database → Extensions**: enable `pg_cron`.
5. Run the migrations in order in the SQL editor (or `supabase db push`):
   - `migrations/0001_scores.sql` — scores table + RLS
   - `migrations/0002_distributions.sql` — public distributions + rebuild fn
   - `migrations/0003_cron.sql` — hourly rebuild at :07
6. Copy the project URL and the anon/publishable key
   (**Settings → API**) into `src/lib/supabaseConfig.ts` and deploy. Both
   are public by design — no repo secrets, no CI changes.

## How it works

- The client mints an anonymous auth user **lazily, on first score
  submission** — so `auth.users` ≈ players who finished a game, which keeps
  DAU/retention numbers honest. supabase-js persists the session in
  localStorage and reuses it across days.
- Scores are queued in localStorage and flushed fire-and-forget; RLS accepts
  inserts only for dates within utc±1 day of now, and there are no
  update/delete policies — submitted scores are immutable.
- `rebuild_distributions()` (pg_cron, hourly) aggregates the same date
  window into `daily_distributions` — a 90-bucket histogram per
  (date, mode, continent). Once a date leaves the writable window its
  distribution is frozen forever.
- The client fetches one distribution row and computes its percentile
  locally (`src/lib/percentile.ts`); nothing renders below 20 samples.

## Accounts

- "Save your stats" in the stats modal calls `auth.updateUser({ email })` on
  the **existing anonymous user** — the emailed confirmation link converts
  it to a permanent account **in place**. Same `user_id` before and after,
  so every submitted score stays attached with zero data migration.
- If the address already has a Bearing account, the client falls back to
  `signInWithOtp` (a sign-in link instead). Clicking it replaces the
  device's anonymous session with the existing account and pulls that
  account's scores into local history (local entries win on conflicts).
- **Accepted limitation:** scores a device submitted anonymously *before*
  signing into an existing account remain attached to the orphaned
  anonymous user server-side. They still count in past distributions
  (histograms are frozen facts about who played that day) but don't follow
  the account.
- Devices with a linked session re-sync passively: on each load the client
  merges the account's server-side scores into local history at idle.

## Verifying after setup

Finish a game on the deployed site and check that a row lands in `scores`
with your local date. The percentile line needs ≥20 samples, so before
launch, seed synthetic players (SQL editor runs as `postgres`, which
bypasses RLS; **test data only — delete it afterwards**):

```sql
with u as (
  insert into auth.users (instance_id, id, aud, role, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
         'authenticated', 'authenticated', now(), now()
    from generate_series(1, 30)
  returning id
)
insert into scores (user_id, date, mode, continent, score, errors)
select u.id, current_date, 'global', null, s.sc,
       array_fill((s.sc / 5)::smallint, array[5])
  from u, lateral (select (50 + random() * 500)::smallint as sc) s;

select public.rebuild_distributions();
select sample_count, histogram from daily_distributions where date = current_date;
```

Reload the results screen — the "Top X%" line should render. Clean up by
deleting the seeded `auth.users` rows (spot them by `created_at`); their
scores cascade, then re-run `rebuild_distributions()`.

## Analytics

`analytics.sql` holds ready-made queries (DAU/WAU/MAU, retention cohorts,
streaks, mode split) over `scores` + `auth.users` — run them in the SQL
editor.
