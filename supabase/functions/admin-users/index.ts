// Supabase Edge Function: admin-users
//
// Backs the Admin screen's "Nutzerverwaltung" tab: search a user by exact
// email and delete their account. Unlike admin-products/admin-articles,
// this touches auth.users directly (account deletion), so — unlike those
// two — it verifies the caller's identity itself instead of trusting that
// only the Admin tab ever calls it: any authenticated user's JWT would
// otherwise be enough to delete an arbitrary account.
//
// POST body: { email }
//   -> searches for a user with that exact (case-insensitive) email,
//      responds with { user: { id, email, createdAt } | null }.
// DELETE body: { id }
//   -> deletes that user's auth account (cascades to profiles/ratings/
//      comments via their "on delete cascade" foreign keys), responds
//      with { success: true }.

import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_EMAIL = "nl@snakkers.de";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
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

async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer /i, "");
  if (!token) {
    return jsonResponse({ error: "Nicht angemeldet." }, 401);
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || data.user?.email !== ADMIN_EMAIL) {
    return jsonResponse({ error: "Nicht autorisiert." }, 403);
  }
  return null;
}

// The Admin API has no "find by email" endpoint (only paginated listUsers),
// so this pages through users looking for an exact match. Fine for the
// user counts this app has "for now" — revisit if that ever changes.
async function findUserByEmail(email: string) {
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) {
      return match;
    }
    if (data.users.length < perPage) {
      break;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const unauthorized = await requireAdmin(req);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (typeof body.email !== "string" || !body.email.trim()) {
        return jsonResponse({ error: 'Feld "email" fehlt oder ist leer.' }, 400);
      }
      const user = await findUserByEmail(body.email);
      return jsonResponse({
        user: user ? { id: user.id, email: user.email, createdAt: user.created_at } : null,
      });
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      if (typeof body.id !== "string" || !body.id) {
        return jsonResponse({ error: 'Feld "id" fehlt.' }, 400);
      }

      const { data: target, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(body.id);
      if (lookupError || !target.user) {
        return jsonResponse({ error: "Nutzer nicht gefunden." }, 404);
      }
      if (target.user.email === ADMIN_EMAIL) {
        return jsonResponse({ error: "Der Admin-Account kann hier nicht gelöscht werden." }, 400);
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(body.id);
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
