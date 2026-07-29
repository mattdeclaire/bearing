-- Batch-computed per-day score distributions, publicly readable. The client
-- fetches one row and computes its own percentile — no live aggregate
-- queries, no per-user data exposed.

create table public.daily_distributions (
  date         date not null,
  mode         text not null,
  continent    text not null default 'all', -- 'all' for global mode
  -- 90 counts; bucket i holds scores in [i*10, i*10+10), 900 folds into 89.
  histogram    integer[] not null,
  sample_count integer not null,
  updated_at   timestamptz not null default now(),
  primary key (date, mode, continent)
);

alter table public.daily_distributions enable row level security;

create policy distributions_public_read on public.daily_distributions
  for select to anon, authenticated using (true);

-- Rebuilds distributions for the RLS-writable date window (current_date ± 1).
-- Rows outside that window can no longer receive scores, so they never need
-- another pass.
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

-- Only pg_cron (running as the owner) should call this — keep it off the
-- public PostgREST RPC surface.
revoke execute on function public.rebuild_distributions() from public, anon, authenticated;
