// Supabase Edge Function: admin-manufacturers
//
// Lets an admin register a manufacturer's sitemap directly (Admin screen's
// "Neue Produkte gefunden" tab) without needing to scrape a product from
// that site first — see registerNewManufacturer in
// ../_shared/manufacturerSitemap.ts. Once registered, the domain is picked
// up by the same daily check-manufacturer-sitemaps cron as any
// scrape-discovered manufacturer, no separate scheduling needed.
//
// POST body: { url }
//   -> registers the URL's hostname, responds with
//      { hostname, sitemapUrl, hasSitemap }.
//      409 if that hostname is already registered.

import { createClient } from "npm:@supabase/supabase-js@2";
import { registerNewManufacturer } from "../_shared/manufacturerSitemap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Methode nicht unterstützt." }, 405);
  }

  try {
    const body = await req.json();
    if (typeof body.url !== "string" || !body.url.trim()) {
      return jsonResponse({ error: 'Feld "url" fehlt oder ist leer.' }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url.trim());
    } catch {
      return jsonResponse({ error: "Das ist keine gültige URL." }, 400);
    }

    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("manufacturers")
      .select("id")
      .eq("hostname", hostname)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ error: existingError.message }, 500);
    }
    if (existing) {
      return jsonResponse({ error: "Für diese Domain ist bereits eine Sitemap gespeichert." }, 409);
    }

    const { sitemapUrl, hasSitemap } = await registerNewManufacturer(supabaseAdmin, hostname);
    return jsonResponse({ hostname, sitemapUrl, hasSitemap });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler." },
      500,
    );
  }
});
