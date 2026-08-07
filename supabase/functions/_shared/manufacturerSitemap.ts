// Shared manufacturer + sitemap collection logic — used by both
// scrape-product (registers/rechecks the manufacturer of whatever product
// was just scraped, best-effort) and check-manufacturer-sitemaps (the daily
// cron job that rechecks every known manufacturer). See supabase/migrations/
// 0009_manufacturers.sql and 0011_manufacturer_sitemap_initial_snapshot.sql
// for the "why" behind the schema this writes to.
//
// Everything here is best-effort: manufacturer sites are arbitrary
// third-party pages we don't control, so missing robots.txt, a missing/
// malformed sitemap, or a blocked fetch are all expected outcomes, not
// errors worth failing the caller over.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const BROWSER_LIKE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";
export const FETCH_HEADERS = {
  "User-Agent": BROWSER_LIKE_UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

function parseSitemapUrlEntries(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const blockRegex = /<url>([\s\S]*?)<\/url>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml))) {
    const block = match[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
    if (!locMatch) {
      continue;
    }
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/i);
    entries.push({ url: decodeHtmlEntities(locMatch[1].trim()), lastmod: lastmodMatch?.[1]?.trim() ?? null });
  }
  return entries;
}

function parseSitemapIndexLocs(xml: string): string[] {
  const locs: string[] = [];
  const blockRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml))) {
    const locMatch = match[1].match(/<loc>([^<]+)<\/loc>/i);
    if (locMatch) {
      locs.push(decodeHtmlEntities(locMatch[1].trim()));
    }
  }
  return locs;
}

async function tryFetchSitemapXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    return /<urlset|<sitemapindex/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

// A sitemap index can point at dozens of child sitemaps (products, pages,
// blog posts, ...) — capped so one manufacturer can't make this run away
// with fetches or blow the function's execution time limit.
const MAX_CHILD_SITEMAPS = 15;

export async function discoverAndFetchSitemap(
  hostname: string,
): Promise<{ sitemapUrl: string; entries: SitemapEntry[] } | null> {
  let sitemapUrl: string | null = null;

  try {
    const robotsRes = await fetch(`https://${hostname}/robots.txt`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (robotsRes.ok) {
      const robotsText = await robotsRes.text();
      const match = robotsText.match(/^\s*Sitemap:\s*(\S+)/im);
      if (match?.[1]) {
        sitemapUrl = match[1].trim();
      }
    }
  } catch {
    // No robots.txt (or it's unreachable) — fall through to guessing.
  }

  let xml = sitemapUrl ? await tryFetchSitemapXml(sitemapUrl) : null;

  if (!xml) {
    for (const path of ['sitemap.xml', 'sitemap_index.xml', 'sitemap-index.xml']) {
      const candidateUrl = `https://${hostname}/${path}`;
      const candidateXml = await tryFetchSitemapXml(candidateUrl);
      if (candidateXml) {
        sitemapUrl = candidateUrl;
        xml = candidateXml;
        break;
      }
    }
  }

  if (!xml || !sitemapUrl) {
    return null;
  }

  if (/<sitemapindex/i.test(xml)) {
    const childUrls = parseSitemapIndexLocs(xml).slice(0, MAX_CHILD_SITEMAPS);
    const entries: SitemapEntry[] = [];
    for (const childUrl of childUrls) {
      const childXml = await tryFetchSitemapXml(childUrl);
      if (childXml) {
        entries.push(...parseSitemapUrlEntries(childXml));
      }
    }
    return { sitemapUrl, entries };
  }

  return { sitemapUrl, entries: parseSitemapUrlEntries(xml) };
}

// Real-world sitemaps sometimes list the same URL twice (seen on iglo.de,
// for instance). A duplicate landing in one insert() call fails that entire
// statement (unique violation), which can silently drop whole chunks —
// dedupe by URL and chunk every bulk insert through this helper so that
// never happens, whether it's the initial snapshot or a later re-check.
export async function insertSitemapEntryRows(
  supabaseAdmin: SupabaseClient,
  manufacturerId: string,
  entries: SitemapEntry[],
  initialSnapshot: boolean,
): Promise<number> {
  const seenUrls = new Set<string>();
  const rows = entries
    .filter((entry) => {
      if (seenUrls.has(entry.url)) {
        return false;
      }
      seenUrls.add(entry.url);
      return true;
    })
    .map((entry) => ({
      manufacturer_id: manufacturerId,
      url: entry.url,
      lastmod: entry.lastmod,
      initial_snapshot: initialSnapshot,
    }));

  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const { error: entriesError } = await supabaseAdmin
      .from('manufacturer_sitemap_entries')
      .insert(rows.slice(i, i + CHUNK_SIZE));
    if (entriesError) {
      console.error('Failed to insert manufacturer_sitemap_entries chunk:', entriesError);
    }
  }
  return rows.length;
}

// A manufacturer whose sitemap was already checked recently is skipped by
// callers — re-fetching and diffing a large sitemap too often would be
// wasteful; a genuinely new product added to a sitemap is still caught the
// next time a check is due after this interval has passed. Shared by the
// scrape-product side-effect check and the daily check-manufacturer-sitemaps
// cron job so the two never duplicate work within the same window.
export const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Fetches the manufacturer's current sitemap again and inserts only the
// URLs not already known for it (initial_snapshot: false) — these, unlike
// the one-time initial dump, are genuinely new products since the sitemap
// was last checked. See migration 0011 for why that distinction matters.
export async function recheckManufacturerSitemap(
  supabaseAdmin: SupabaseClient,
  manufacturerId: string,
  hostname: string,
): Promise<{ newCount: number }> {
  const sitemapResult = await discoverAndFetchSitemap(hostname);

  await supabaseAdmin
    .from('manufacturers')
    .update({
      sitemap_url: sitemapResult?.sitemapUrl ?? null,
      sitemap_checked_at: new Date().toISOString(),
    })
    .eq('id', manufacturerId);

  if (!sitemapResult || sitemapResult.entries.length === 0) {
    return { newCount: 0 };
  }

  const { data: existingRows } = await supabaseAdmin
    .from('manufacturer_sitemap_entries')
    .select('url')
    .eq('manufacturer_id', manufacturerId);
  const existingUrls = new Set((existingRows ?? []).map((row) => row.url as string));

  const newEntries = sitemapResult.entries.filter((entry) => !existingUrls.has(entry.url));
  if (newEntries.length === 0) {
    return { newCount: 0 };
  }

  const inserted = await insertSitemapEntryRows(supabaseAdmin, manufacturerId, newEntries, false);
  return { newCount: inserted };
}

// Registers a manufacturer (by hostname) and its sitemap the first time any
// product from that site is scraped, then re-checks that sitemap for
// genuinely new URLs (not the whole existing catalog) on later calls, at
// most once per RECHECK_INTERVAL_MS. The existence check runs before the
// (potentially slow) sitemap fetch so repeat calls stay fast when no
// re-check is due; the initial insert still uses ignoreDuplicates as a
// safety net against a race between two concurrent first-time calls.
export async function registerOrRecheckManufacturer(
  supabaseAdmin: SupabaseClient,
  hostname: string,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('manufacturers')
    .select('id, sitemap_checked_at')
    .eq('hostname', hostname)
    .maybeSingle();

  if (existing) {
    const lastChecked = existing.sitemap_checked_at ? new Date(existing.sitemap_checked_at as string).getTime() : 0;
    if (Date.now() - lastChecked >= RECHECK_INTERVAL_MS) {
      await recheckManufacturerSitemap(supabaseAdmin, existing.id as string, hostname);
    }
    return;
  }

  const sitemapResult = await discoverAndFetchSitemap(hostname);

  const { data: manufacturers, error: insertError } = await supabaseAdmin
    .from('manufacturers')
    .upsert(
      {
        hostname,
        homepage_url: `https://${hostname}/`,
        sitemap_url: sitemapResult?.sitemapUrl ?? null,
        sitemap_checked_at: sitemapResult ? new Date().toISOString() : null,
      },
      { onConflict: 'hostname', ignoreDuplicates: true },
    )
    .select('id');

  if (insertError) {
    throw insertError;
  }
  // ignoreDuplicates means a concurrent first-time call can win the race
  // and leave this insert with no returned row — nothing left to do then,
  // the other call already owns registering this manufacturer's entries.
  const manufacturerId = manufacturers?.[0]?.id;
  if (!manufacturerId || !sitemapResult || sitemapResult.entries.length === 0) {
    return;
  }

  await insertSitemapEntryRows(supabaseAdmin, manufacturerId, sitemapResult.entries, true);
}
