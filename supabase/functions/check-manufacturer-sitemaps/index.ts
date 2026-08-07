// Supabase Edge Function: check-manufacturer-sitemaps
//
// The daily counterpart to scrape-product's best-effort manufacturer check:
// scrape-product only rechecks the one manufacturer whose product an admin
// happens to scrape, so a manufacturer nobody scrapes from for a while would
// never get rechecked. This function instead walks every known manufacturer
// and rechecks each whose sitemap is due (same RECHECK_INTERVAL_MS as
// scrape-product, so the two never duplicate work within the same window).
//
// Scheduled via pg_cron once a day — see supabase/migrations/
// 0013_daily_sitemap_check_cron.sql. Can also be invoked manually, e.g. for
// testing: supabase functions invoke check-manufacturer-sitemaps
//
// Reads automation_settings.sitemap_auto_check_enabled (see migration 0012)
// and no-ops immediately if the admin has switched this off from the
// "Neue Produkte gefunden" page.
//
// Deploy: supabase functions deploy check-manufacturer-sitemaps

import { createClient } from "npm:@supabase/supabase-js@2";
import { RECHECK_INTERVAL_MS, recheckManufacturerSitemap } from "../_shared/manufacturerSitemap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { data: settings } = await supabaseAdmin
    .from("automation_settings")
    .select("sitemap_auto_check_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (settings && settings.sitemap_auto_check_enabled === false) {
    return jsonResponse({ skipped: true, reason: "disabled" });
  }

  const { data: manufacturers, error: manufacturersError } = await supabaseAdmin
    .from("manufacturers")
    .select("id, hostname, sitemap_checked_at");

  if (manufacturersError) {
    return jsonResponse({ error: manufacturersError.message }, 500);
  }

  const results: { hostname: string; newCount?: number; skipped?: boolean; error?: string }[] = [];

  for (const manufacturer of manufacturers ?? []) {
    const lastChecked = manufacturer.sitemap_checked_at
      ? new Date(manufacturer.sitemap_checked_at as string).getTime()
      : 0;
    if (Date.now() - lastChecked < RECHECK_INTERVAL_MS) {
      results.push({ hostname: manufacturer.hostname as string, skipped: true });
      continue;
    }
    try {
      const { newCount } = await recheckManufacturerSitemap(
        supabaseAdmin,
        manufacturer.id as string,
        manufacturer.hostname as string,
      );
      results.push({ hostname: manufacturer.hostname as string, newCount });
    } catch (error) {
      console.error(`Sitemap recheck failed for ${manufacturer.hostname}:`, error);
      results.push({
        hostname: manufacturer.hostname as string,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return jsonResponse({ checked: results.length, results });
});
