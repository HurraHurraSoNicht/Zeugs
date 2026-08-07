// Supabase Edge Function: admin-articles
//
// The only write path into public.articles. RLS on that table intentionally
// blocks insert/update/delete for anon/authenticated (see
// supabase/migrations/0006_articles.sql) — same pattern as admin-products:
// this function (using the service role key, server-side only) is the sole
// way the Admin tab can create, edit, or remove magazine articles.
//
// POST body: { title, teaser, body, imageUrl, tags }
//   -> inserts a new article, responds with the saved row (Article-shaped JSON, camelCase).
// PUT body: { id, title, teaser, body, imageUrl, tags }
//   -> updates the article with that id, responds with the updated row.
// DELETE body: { id }
//   -> deletes the article with that id, responds with { success: true }.

import { createClient } from "npm:@supabase/supabase-js@2";

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

function rowToArticle(row) {
  return {
    id: row.id,
    title: row.title,
    teaser: row.teaser,
    body: row.body,
    imageUrl: row.image_url,
    tags: row.tags ?? [],
    publishedAt: row.published_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      const payload = await req.json();
      if (typeof payload.title !== "string" || !payload.title.trim()) {
        return jsonResponse({ error: 'Feld "title" fehlt oder ist leer.' }, 400);
      }

      const row = {
        title: payload.title,
        teaser: payload.teaser ?? null,
        body: payload.body ?? null,
        image_url: payload.imageUrl ?? null,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
      };

      const { data, error } = await supabaseAdmin
        .from("articles")
        .insert(row)
        .select()
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse(rowToArticle(data));
    }

    if (req.method === "PUT") {
      const payload = await req.json();
      if (typeof payload.id !== "string" || !payload.id) {
        return jsonResponse({ error: 'Feld "id" fehlt.' }, 400);
      }
      if (typeof payload.title !== "string" || !payload.title.trim()) {
        return jsonResponse({ error: 'Feld "title" fehlt oder ist leer.' }, 400);
      }

      const row = {
        title: payload.title,
        teaser: payload.teaser ?? null,
        body: payload.body ?? null,
        image_url: payload.imageUrl ?? null,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
      };

      const { data, error } = await supabaseAdmin
        .from("articles")
        .update(row)
        .eq("id", payload.id)
        .select()
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse(rowToArticle(data));
    }

    if (req.method === "DELETE") {
      const payload = await req.json();
      if (typeof payload.id !== "string" || !payload.id) {
        return jsonResponse({ error: 'Feld "id" fehlt.' }, 400);
      }

      const { error } = await supabaseAdmin.from("articles").delete().eq("id", payload.id);
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
