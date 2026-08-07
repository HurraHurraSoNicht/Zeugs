// Supabase Edge Function: admin-settings
//
// The only write path into public.automation_settings. RLS on that table
// intentionally blocks update for anon/authenticated (see supabase/
// migrations/0012_automation_settings.sql) — same pattern as admin-articles/
// admin-products: this function (service role key, server-side only) is the
// sole way the Admin tab's toggle can change automation flags.
//
// PUT body: { sitemapAutoCheckEnabled: boolean }
//   -> updates the singleton settings row, responds with the updated row
//      (camelCase JSON).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
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

function rowToSettings(row: { sitemap_auto_check_enabled: boolean }) {
  return { sitemapAutoCheckEnabled: row.sitemap_auto_check_enabled };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "PUT") {
      const payload = await req.json();
      if (typeof payload.sitemapAutoCheckEnabled !== "boolean") {
        return jsonResponse({ error: 'Feld "sitemapAutoCheckEnabled" fehlt oder ist ungültig.' }, 400);
      }

      const { data, error } = await supabaseAdmin
        .from("automation_settings")
        .update({
          sitemap_auto_check_enabled: payload.sitemapAutoCheckEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1)
        .select()
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse(rowToSettings(data));
    }

    return jsonResponse({ error: "Methode nicht unterstützt." }, 405);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler." },
      500,
    );
  }
});
