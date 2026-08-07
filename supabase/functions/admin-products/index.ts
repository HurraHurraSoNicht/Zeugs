// Supabase Edge Function: admin-products
//
// The only write path into public.products. RLS on that table intentionally
// blocks insert/update/delete for anon/authenticated (see
// supabase/migrations/0001_init.sql) — the app has no login/admin-role
// system yet, so this function (using the service role key, server-side
// only) is the sole way the Admin tab can create or remove products. The
// client's own Supabase key stays read-only.
//
// POST body: { name, brand, quantity, description, imageUrl, source, sourceUrl, category, tags, categories, nutrition }
//   -> inserts a new product, responds with the saved row (Product-shaped JSON, camelCase).
// PUT body: { id, name, brand, quantity, description, imageUrl, source, sourceUrl, category, tags, categories, nutrition }
//   -> updates the product with that id, responds with the updated row (Product-shaped JSON, camelCase).
// DELETE body: { id }
//   -> deletes the product with that id, responds with { success: true }.
//
// Whenever imageUrl points somewhere other than our own "product-images"
// Storage bucket (a scraped CDN URL, an Open Food Facts image, a manually
// pasted link, ...), this downloads it server-to-server (no browser CORS
// involved, same reasoning as scrape-product) and re-uploads it to that
// bucket before saving — so the product's photo survives even if the
// original source later removes/moves it. Best-effort: if the download or
// upload fails for any reason, the original URL is kept rather than
// blocking the save.

import { createClient } from "npm:@supabase/supabase-js@2";
import { rehostImageUrl } from "../_shared/productImageRehost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    quantity: row.quantity,
    description: row.description,
    imageUrl: row.image_url,
    source: row.source,
    sourceUrl: row.source_url,
    category: row.category,
    discoveredAt: row.discovered_at,
    averageRating: row.average_rating,
    ratingsCount: row.ratings_count,
    tags: row.tags ?? [],
    categories: row.categories ?? [],
    nutrition: row.nutrition ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonResponse({ error: 'Feld "name" fehlt oder ist leer.' }, 400);
      }

      const row = {
        name: body.name,
        brand: body.brand ?? null,
        quantity: body.quantity ?? null,
        description: body.description ?? null,
        image_url: await rehostImageUrl(supabaseAdmin, body.imageUrl ?? null),
        source: body.source ?? null,
        source_url: body.sourceUrl ?? null,
        category: body.category ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        categories: Array.isArray(body.categories) ? body.categories : [],
        nutrition: body.nutrition ?? null,
      };

      const { data, error } = await supabaseAdmin
        .from("products")
        .insert(row)
        .select()
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse(rowToProduct(data));
    }

    if (req.method === "PUT") {
      const body = await req.json();
      if (typeof body.id !== "string" || !body.id) {
        return jsonResponse({ error: 'Feld "id" fehlt.' }, 400);
      }
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonResponse({ error: 'Feld "name" fehlt oder ist leer.' }, 400);
      }

      const row = {
        name: body.name,
        brand: body.brand ?? null,
        quantity: body.quantity ?? null,
        description: body.description ?? null,
        image_url: await rehostImageUrl(supabaseAdmin, body.imageUrl ?? null),
        source: body.source ?? null,
        source_url: body.sourceUrl ?? null,
        category: body.category ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        categories: Array.isArray(body.categories) ? body.categories : [],
        nutrition: body.nutrition ?? null,
      };

      const { data, error } = await supabaseAdmin
        .from("products")
        .update(row)
        .eq("id", body.id)
        .select()
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse(rowToProduct(data));
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      if (typeof body.id !== "string" || !body.id) {
        return jsonResponse({ error: 'Feld "id" fehlt.' }, 400);
      }

      const { error } = await supabaseAdmin.from("products").delete().eq("id", body.id);
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Methode nicht unterstützt." }, 405);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unbekannter Fehler." },
      500,
    );
  }
});
