-- Ready-made engagement queries over scores + auth.users, for the SQL editor.
-- A user exists only once they've finished a game (anonymous sign-in is
-- lazy), so "users" here means players, not visitors — Umami covers the
-- visit → game_start → game_complete funnel upstream of this.

-- 1. DAU: distinct players per day, with mode split.
select date,
       count(distinct user_id)                                as dau,
       count(*) filter (where mode = 'continental')           as continental_games,
       count(*) filter (where mode = 'global')                as global_games
  from scores
 group by date
 order by date desc;

-- 2. WAU / MAU (trailing windows as of today).
select count(distinct user_id) filter (where date > current_date - 7)  as wau,
       count(distinct user_id) filter (where date > current_date - 30) as mau,
       count(distinct user_id)                                          as all_time
  from scores;

-- 3. Retention: share of each signup cohort playing again D1 / D7 / D30.
with firsts as (
  select user_id, min(date) as first_date from scores group by user_id
)
select f.first_date                                             as cohort,
       count(*)                                                 as players,
       round(100.0 * count(*) filter (where r.d1)  / count(*))  as d1_pct,
       round(100.0 * count(*) filter (where r.d7)  / count(*))  as d7_pct,
       round(100.0 * count(*) filter (where r.d30) / count(*))  as d30_pct
  from firsts f
  cross join lateral (
    select bool_or(s.date = f.first_date + 1)                              as d1,
           bool_or(s.date between f.first_date + 1 and f.first_date + 7)   as d7,
           bool_or(s.date between f.first_date + 1 and f.first_date + 30)  as d30
      from scores s where s.user_id = f.user_id
  ) r
 group by f.first_date
 order by f.first_date desc;

-- 4. Current-streak histogram: how many players are on an n-day streak
--    (streak = run of consecutive played dates reaching today or yesterday).
with runs as (
  select user_id, date, date - (dense_rank() over w)::int as grp
    from (select distinct user_id, date from scores) d
  window w as (partition by user_id order by date)
)
select streak, count(*) as players
  from (select user_id, count(*) as streak
          from runs
         group by user_id, grp
        having max(date) >= current_date - 1) s
 group by streak
 order by streak;

-- 5. Engagement depth: games per player distribution.
select games, count(*) as players
  from (select user_id, count(*) as games from scores group by user_id) g
 group by games
 order by games;

-- 6. Score quality over time: daily median score per mode, and sample sizes.
select date, mode,
       percentile_cont(0.5) within group (order by score) as median_score,
       count(*)                                           as games
  from scores
 group by date, mode
 order by date desc, mode;
