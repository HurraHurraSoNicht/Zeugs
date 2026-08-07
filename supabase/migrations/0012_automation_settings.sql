-- 0012_automation_settings.sql
--
-- Singleton settings row for background automation the admin can toggle
-- from the app — starting with the daily manufacturer-sitemap re-check (see
-- check-manufacturer-sitemaps Edge Function and migration 0013's cron
-- schedule). The `id = 1` check enforces there's ever only one row, since
-- there's exactly one app-wide setting, not per-user preferences.
create table if not exists public.automation_settings (
  id integer primary key default 1 check (id = 1),
  sitemap_auto_check_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.automation_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.automation_settings enable row level security;

-- Publicly readable (consistent with the rest of the schema, e.g.
-- manufacturers/products/articles) so the Admin toggle can reflect the
-- current state. Writes only via the admin-settings Edge Function's service
-- role key — no anon/authenticated write policy is granted, same lockdown
-- as every other admin-mutable table.
create policy "automation settings are publicly readable"
  on public.automation_settings for select
  using (true);
