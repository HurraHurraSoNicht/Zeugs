export interface NewSitemapEntry {
  id: string;
  url: string;
  lastmod: string | null;
  firstSeenAt: string;
  manufacturerHostname: string;
}

export interface ManufacturerSitemapSummary {
  hostname: string;
  sitemapUrl: string;
  // Null when a sitemap was found and stored but no re-check has ever
  // turned up a genuinely new URL for it yet (see initial_snapshot in
  // supabase/migrations/0011_manufacturer_sitemap_initial_snapshot.sql).
  lastNewEntryAt: string | null;
}
