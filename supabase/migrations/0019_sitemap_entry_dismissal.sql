-- 0019_sitemap_entry_dismissal.sql
--
-- "Alle löschen" on the Admin "Neue Produkte gefunden" list only hid
-- entries in local component state — reloading the page (or just coming
-- back later) brought every previously-cleared URL right back, since
-- nothing was ever persisted. This column lets a dismissal stick: once
-- set, fetchNewSitemapEntries excludes the row permanently instead of
-- relying on client-side memory.
alter table public.manufacturer_sitemap_entries
  add column if not exists dismissed_at timestamptz;
