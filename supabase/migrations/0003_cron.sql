-- Requires the pg_cron extension (Dashboard → Database → Extensions).
-- Hourly at :07 — same-day percentiles appear within the hour.

select cron.schedule('rebuild-distributions', '7 * * * *',
                     $$select public.rebuild_distributions()$$);
