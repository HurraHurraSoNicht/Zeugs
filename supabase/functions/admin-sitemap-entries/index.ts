// Supabase Edge Function: admin-sitemap-entries
//
// Persists "Alle löschen" on the Admin screen's "Neue Produkte gefunden"
// list — RLS blocks writes to manufacturer_sitemap_entries for the anon
// key (see supabase/migrations/0009_manufacturers.sql), so marking rows
// dismissed goes through here (service role key) same as every other
// admin-* write.
//
// DELETE body: { ids: string[] }
//   -> sets dismissed_at = now() on those rows, responds with
//      { success: true }. fetchNewSitemapEntries (see
//      src/services/manufacturersApi.ts) excludes dismissed rows from
//      then on, so they never reappear after a reload.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
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

  if (req.method !== "DELETE") {
    return jsonResponse({ error: "Methode nicht unterstützt." }, 405);
  }

  try {
    const body = await req.json();
    if (!Array.isArray(body.ids) || body.ids.some((id: unknown) => typeof id !== "string") || body.ids.length === 0) {
      return jsonResponse({ error: 'Feld "ids" fehlt oder ist leer.' }, 400);
    }

    const { error } = await supabaseAdmin
      .from("manufacturer_sitemap_entries")
      .update({ dismissed_at: new Date().toISOString() })
      .in("id", body.ids);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler." },
      500,
    );
  }
});
