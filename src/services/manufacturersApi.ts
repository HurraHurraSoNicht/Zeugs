import { getSupabase } from './supabaseClient';
import type { ManufacturerSitemapSummary, NewSitemapEntry } from '../types/manufacturer';

// How far back a sitemap entry's first_seen_at may be to still count as
// "neu gefunden" on the Admin page — matches the product ProductCard's
// "Neu"-Badge cutoff (see src/components/ProductCard.tsx) for consistency.
const NEW_ENTRY_MAX_AGE_DAYS = 7;

interface SitemapEntryRow {
  id: string;
  url: string;
  lastmod: string | null;
  first_seen_at: string;
  manufacturers: { hostname: string } | null;
}

function rowToEntry(row: SitemapEntryRow): NewSitemapEntry {
  return {
    id: row.id,
    url: row.url,
    lastmod: row.lastmod,
    firstSeenAt: row.first_seen_at,
    manufacturerHostname: row.manufacturers?.hostname ?? 'Unbekannter Hersteller',
  };
}

// Reads are publicly allowed by RLS (see supabase/migrations/0009_manufacturers.sql),
// so this goes straight to the tables with the anon key, same as fetchProducts.
// initial_snapshot=false excludes each manufacturer's one-time initial sitemap
// dump (mostly years-old URLs, not new products) — see migration 0011.
export async function fetchNewSitemapEntries(): Promise<NewSitemapEntry[]> {
  const cutoff = new Date(Date.now() - NEW_ENTRY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from('manufacturer_sitemap_entries')
    .select('id, url, lastmod, first_seen_at, manufacturers(hostname)')
    .eq('initial_snapshot', false)
    .gte('first_seen_at', cutoff)
    .order('first_seen_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  // supabase-js infers this embed as an array without generated Database
  // types; the manufacturer_id FK makes it a to-one relationship, and the
  // actual REST response confirms a single object (or null) per row.
  return (data as unknown as SitemapEntryRow[]).map(rowToEntry);
}

// One row per manufacturer whose sitemap we've actually found (sitemap_url
// not null — manufacturers where discovery failed have nothing useful to
// show here). lastNewEntryAt is computed client-side rather than via a SQL
// aggregate: no generated-columns/RPC layer exists in this project yet, and
// the entry counts here are small enough that fetching all
// initial_snapshot=false rows and reducing in JS is simpler than adding one.
export async function fetchManufacturerSitemapSummaries(): Promise<ManufacturerSitemapSummary[]> {
  const [manufacturersResult, entriesResult] = await Promise.all([
    getSupabase()
      .from('manufacturers')
      .select('id, hostname, sitemap_url')
      .not('sitemap_url', 'is', null),
    getSupabase()
      .from('manufacturer_sitemap_entries')
      .select('manufacturer_id, first_seen_at')
      .eq('initial_snapshot', false)
      .order('first_seen_at', { ascending: false }),
  ]);

  if (manufacturersResult.error) {
    throw new Error(manufacturersResult.error.message);
  }
  if (entriesResult.error) {
    throw new Error(entriesResult.error.message);
  }

  // Rows arrive newest-first, so the first hit per manufacturer_id is its
  // most recent "genuinely new" sitemap entry.
  const lastNewEntryByManufacturerId = new Map<string, string>();
  for (const row of entriesResult.data as { manufacturer_id: string; first_seen_at: string }[]) {
    if (!lastNewEntryByManufacturerId.has(row.manufacturer_id)) {
      lastNewEntryByManufacturerId.set(row.manufacturer_id, row.first_seen_at);
    }
  }

  const manufacturers = manufacturersResult.data as { id: string; hostname: string; sitemap_url: string }[];
  return manufacturers
    .map((manufacturer) => ({
      hostname: manufacturer.hostname,
      sitemapUrl: manufacturer.sitemap_url,
      lastNewEntryAt: lastNewEntryByManufacturerId.get(manufacturer.id) ?? null,
    }))
    .sort((a, b) => {
      if (!a.lastNewEntryAt && !b.lastNewEntryAt) return a.hostname.localeCompare(b.hostname);
      if (!a.lastNewEntryAt) return 1;
      if (!b.lastNewEntryAt) return -1;
      return b.lastNewEntryAt.localeCompare(a.lastNewEntryAt);
    });
}
