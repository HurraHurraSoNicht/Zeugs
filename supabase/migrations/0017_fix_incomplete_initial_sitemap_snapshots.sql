-- 0017_fix_incomplete_initial_sitemap_snapshots.sql
--
-- exquisa.de and heinz.com have very large sitemaps; their original
-- registration (via scrape-product) likely hit the same Edge Function
-- CPU-time ceiling that motivated the batching fix in migration 0016,
-- leaving most of their initial sitemap dump never inserted. Once the
-- daily recheck started reaching them again, it inserted the missing
-- backlog as initial_snapshot=false — i.e. as "genuinely new" — which
-- would have flooded the Admin "Neue Produkte gefunden" list with
-- thousands of years-old URLs.
--
-- These two manufacturers have no other initial_snapshot=false rows yet
-- (no recheck had ever successfully reached them before), so this simply
-- reclassifies that backlog as what it actually is: initial catalog, not
-- new discoveries.
update public.manufacturer_sitemap_entries
set initial_snapshot = true
where initial_snapshot = false
  and manufacturer_id in (
    select id from public.manufacturers where hostname in ('exquisa.de', 'heinz.com')
  );
