import { getSupabase } from './supabaseClient';
import type { NewSitemapEntry } from '../types/manufacturer';

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
