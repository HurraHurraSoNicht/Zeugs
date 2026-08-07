-- 0013_daily_sitemap_check_cron.sql
--
-- Schedules the check-manufacturer-sitemaps Edge Function once a day so
-- genuinely new products get picked up automatically, not just as a side
-- effect of an admin manually scraping something from that manufacturer.
--
-- pg_cron runs in UTC and does not follow daylight saving time. "18:00" was
-- requested as German wall-clock time; pinned here to 16:00 UTC, which
-- matches 18:00 CEST (summer time, currently in effect). Once CET (winter
-- time, UTC+1) begins this will actually fire at 17:00 German time — update
-- the schedule string below to '0 17 * * *' for winter and back to
-- '0 16 * * *' for summer if the exact wall-clock hour matters.
--
-- The function itself checks automation_settings.sitemap_auto_check_enabled
-- and no-ops immediately if the admin has switched it off — this schedule
-- firing is not itself gated on that flag.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'daily-manufacturer-sitemap-check',
  '0 16 * * *',
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
