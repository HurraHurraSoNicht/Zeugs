-- 0009_manufacturers.sql
-- Collects manufacturer websites and their sitemaps whenever a product is
-- scraped (see supabase/functions/scrape-product/index.ts), so their
-- product listings can be checked periodically for newly added products
-- later. No UI/notification feature is built on top of this yet — this is
-- purely the collection layer ("wir müssen erstmal sammeln").
--
-- Keyed by hostname (not brand name) so "each manufacturer only needed
-- once" is a hard uniqueness guarantee rather than a fuzzy name match.
create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  hostname text not null unique,
  homepage_url text not null,
  sitemap_url text,
  sitemap_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per URL found in a manufacturer's sitemap. first_seen_at/
-- last_seen_at (rather than just a single timestamp) is what a future
-- "check for new products" job needs: a URL whose first_seen_at is recent
-- is a newly discovered product; last_seen_at lets that job tell "still
-- listed" apart from "removed from the sitemap" without deleting rows.
create table if not exists public.manufacturer_sitemap_entries (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id) on delete cascade,
  url text not null,
  -- Stored as text, not timestamptz: sitemap <lastmod> formats vary
  -- (date-only, full ISO datetime, missing entirely) across arbitrary
  -- third-party sites we don't control, and this must never fail to insert
  -- over a parse error.
  lastmod text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (manufacturer_id, url)
);

create index if not exists manufacturer_sitemap_entries_manufacturer_id_idx
  on public.manufacturer_sitemap_entries (manufacturer_id);

alter table public.manufacturers enable row level security;
alter table public.manufacturer_sitemap_entries enable row level security;

-- Publicly readable (consistent with the rest of the schema); writes only
-- via the scrape-product Edge Function's service role key — no anon/
-- authenticated insert/update/delete policy is granted, same lockdown as
-- products/articles.
create policy "manufacturers are publicly readable"
  on public.manufacturers for select
  using (true);

create policy "manufacturer sitemap entries are publicly readable"
  on public.manufacturer_sitemap_entries for select
  using (true);
