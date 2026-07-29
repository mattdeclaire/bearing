-- One row per finished game: (user, local date, mode). The client submits the
-- player's LOCAL date because that's the puzzle's identity (Wordle-style) —
-- everyone comparing against a distribution played the same 5 cities.
--
-- Privacy: continent (1-of-6 coarse) is the only location-derived column, and
-- only for continental mode where the percentile cohort is (date, continent).
-- Coordinates, headings, and city-level data are never sent by the client and
-- have no columns here.

create table public.scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
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

-- The hourly rebuild scans by day, not by user.
create index scores_date_mode_idx on public.scores (date, mode);

alter table public.scores enable row level security;

-- Insert own scores only, and only for dates near "now" — local dates
-- worldwide span utc±1 day. No UPDATE/DELETE policies: scores are immutable
-- (light anti-cheat), and it means distributions older than the window are
-- provably frozen.
create policy scores_insert_own on public.scores
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and date between (now() at time zone 'utc')::date - 1
                 and (now() at time zone 'utc')::date + 1
  );

-- Read own rows only (powers cross-device history restore). No public read.
create policy scores_select_own on public.scores
  for select to authenticated using (auth.uid() = user_id);
