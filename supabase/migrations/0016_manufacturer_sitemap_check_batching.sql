-- 0016_manufacturer_sitemap_check_batching.sql
--
-- check-manufacturer-sitemaps now only processes a bounded, most-overdue-
-- first batch per invocation (see BATCH_SIZE in that function) instead of
-- every manufacturer in one go — Supabase Edge Functions cap CPU time at
-- 2s per invocation, and with enough manufacturers registered the old
-- unbounded, unordered loop stopped finishing the full list, silently
-- skipping whichever manufacturers happened to land after the cutoff that
-- day (varying day to day since the query had no explicit order).
--
-- Once-a-day at 18:00 no longer gives every manufacturer a turn, so this
-- reschedules the same job to run hourly instead — comfortably enough
-- capacity (BATCH_SIZE * 24 runs/day) to cover the current list many times
-- over, self-healing as it grows.
select cron.unschedule('daily-manufacturer-sitemap-check');

select cron.schedule(
  'hourly-manufacturer-sitemap-check',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://fkmzcqjvrolhuwdjfdil.supabase.co/functions/v1/check-manufacturer-sitemaps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_ODU70Ql67xLh5vQ4_q55yQ_3dR5Pp0k',
      'Authorization', 'Bearer sb_publishable_ODU70Ql67xLh5vQ4_q55yQ_3dR5Pp0k'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
