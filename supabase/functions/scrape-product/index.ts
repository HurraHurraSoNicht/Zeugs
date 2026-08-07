// Supabase Edge Function: scrape-product
//
// Fetches a product page server-side (no browser CORS involved — this is a
// server-to-server request) and extracts name/brand/description/image/
// nutrition best-effort from schema.org Product JSON-LD and Open Graph meta
// tags. Nutrition is only found on the minority of sites that embed
// schema.org NutritionInformation; it's fine for that field to come back null.
//
// As a side effect, this also registers/rechecks the manufacturer's site +
// sitemap (see registerOrRecheckManufacturer in ../_shared/
// manufacturerSitemap.ts and supabase/migrations/0009_manufacturers.sql /
// 0011_manufacturer_sitemap_initial_snapshot.sql) — the same daily job that
// check-manufacturer-sitemaps runs on a schedule also gets a free ride here
// whenever an admin scrapes a product from that manufacturer. Best-effort
// and isolated from the main scrape: any failure there is swallowed so it
// never breaks the actual product scrape the caller asked for.
//
// Deploy: supabase functions deploy scrape-product
// Invoke from the client via supabase.functions.invoke('scrape-product', { body: { url } })

import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeHtmlEntities, FETCH_HEADERS, registerOrRecheckManufacturer } from "../_shared/manufacturerSitemap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

type JsonLdProduct = Record<string, unknown>;

function extractMetaContent(html: string, propertyOrName: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${propertyOrName}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${propertyOrName}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractJsonLdProduct(html: string): JsonLdProduct | null {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html))) {
    try {
      const json = JSON.parse(match[1].trim());
      const candidates = Array.isArray(json) ? json : [json];
      for (const candidate of candidates) {
        const type = candidate?.['@type'];
        if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
          return candidate as JsonLdProduct;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractNutritionFromJsonLd(jsonLd: JsonLdProduct | null) {
  const nutrition = jsonLd?.nutrition as Record<string, unknown> | undefined;
  if (!nutrition) {
    return null;
  }
  return {
    energyKcal: toNumber(nutrition.calories),
    energyKj: null,
    fat: toNumber(nutrition.fatContent),
    saturatedFat: toNumber(nutrition.saturatedFatContent),
    carbohydrates: toNumber(nutrition.carbohydrateContent),
    sugars: toNumber(nutrition.sugarContent),
    fiber: toNumber(nutrition.fiberContent),
    protein: toNumber(nutrition.proteinContent),
    salt: toNumber(nutrition.sodiumContent),
  };
}

// Fallback for the vast majority of sites that don't embed schema.org
// nutrition data: strip tags to plain text and look for the same
// label+number patterns a EU nutrition table uses (mirrors
// src/utils/parseNutritionText.ts on the client — kept as a separate copy
// since this runs in Deno, a different runtime/deployment than the app).
// Best-effort and noisier than a clean paste (page text can contain
// unrelated numbers), so only used when JSON-LD has nothing.
function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractByLabel(text: string, labelPattern: string): { value: number | null; text: string } {
  const regex = new RegExp(`(?:${labelPattern})\\s*[:\\-]?\\s*([\\d]+(?:[.,]\\d+)?)`, "i");
  const match = regex.exec(text);
  if (!match || match.index == null) {
    return { value: null, text };
  }
  const value = parseFloat(match[1].replace(",", "."));
  const cleaned = text.slice(0, match.index) + text.slice(match.index + match[0].length);
  return { value: Number.isFinite(value) ? value : null, text: cleaned };
}

function extractByUnit(text: string, unitPattern: string): number | null {
  const regex = new RegExp(`([\\d]+(?:[.,]\\d+)?)\\s*${unitPattern}\\b`, "i");
  const match = regex.exec(text);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function extractNutritionFromPageText(html: string) {
  const rawText = stripHtmlToText(html);
  let working = rawText;

  const saturatedFat = extractByLabel(
    working,
    "(?:davon\\s+)?ges[äa]ttigte[n]?\\s+fetts[äa]uren|saturated\\s+fat",
  );
  working = saturatedFat.text;

  const sugars = extractByLabel(working, "(?:davon\\s+)?zucker|sugars?");
  working = sugars.text;

  const fat = extractByLabel(working, "fett(?!s[äa]uren)|fat");
  working = fat.text;

  const carbohydrates = extractByLabel(working, "kohlenhydrate|carbohydrates?");
  working = carbohydrates.text;

  const fiber = extractByLabel(working, "ballaststoffe|fiber|fibre");
  working = fiber.text;

  const protein = extractByLabel(working, "eiwei[ßs]s?|protein");
  working = protein.text;

  const salt = extractByLabel(working, "salz|salt");
  working = salt.text;

  const energyKcal = extractByUnit(rawText, "kcal");
  const energyKj = extractByUnit(rawText, "kj");

  const nutrition = {
    energyKcal,
    energyKj,
    fat: fat.value,
    saturatedFat: saturatedFat.value,
    carbohydrates: carbohydrates.value,
    sugars: sugars.value,
    fiber: fiber.value,
    protein: protein.value,
    salt: salt.value,
  };

  const hasAnyValue = Object.values(nutrition).some((value) => value != null);
  return hasAnyValue ? nutrition : null;
}

function extractBrandFromJsonLd(jsonLd: JsonLdProduct | null): string | null {
  const brand = jsonLd?.brand;
  if (typeof brand === 'string') {
    return brand;
  }
  if (brand && typeof brand === 'object' && typeof (brand as Record<string, unknown>).name === 'string') {
    return (brand as Record<string, unknown>).name as string;
  }
  return null;
}

function extractImageFromJsonLd(jsonLd: JsonLdProduct | null): string | null {
  const image = jsonLd?.image;
  if (typeof image === 'string') {
    return image;
  }
  if (Array.isArray(image) && typeof image[0] === 'string') {
    return image[0];
  }
  return null;
}

// schema.org's QuantitativeValue uses UN/CEFACT Recommendation 20 unit
// codes rather than plain unit strings — this covers the handful actually
// seen on grocery product pages.
const UNIT_CODE_TO_LABEL: Record<string, string> = {
  GRM: 'g',
  KGM: 'kg',
  MLT: 'ml',
  LTR: 'l',
  CLT: 'cl',
};

// schema.org/Product's `weight` (a QuantitativeValue) is the most reliable
// source when present, but German grocery sites often instead stash it in
// an `additionalProperty` entry named "Gewicht"/"Menge"/"Inhalt" etc.
function extractQuantityFromJsonLd(jsonLd: JsonLdProduct | null): string | null {
  const weight = jsonLd?.weight;
  if (typeof weight === 'string' && weight.trim()) {
    return weight.trim();
  }
  if (weight && typeof weight === 'object') {
    const value = (weight as Record<string, unknown>).value;
    const unitText = (weight as Record<string, unknown>).unitText;
    const unitCode = (weight as Record<string, unknown>).unitCode;
    if (value != null) {
      const unit =
        (typeof unitText === 'string' ? unitText : null) ??
        (typeof unitCode === 'string' ? UNIT_CODE_TO_LABEL[unitCode.toUpperCase()] : null);
      return unit ? `${value} ${unit}` : String(value);
    }
  }

  const additionalProperties = jsonLd?.additionalProperty;
  if (Array.isArray(additionalProperties)) {
    for (const property of additionalProperties) {
      if (!property || typeof property !== 'object') {
        continue;
      }
      const name = (property as Record<string, unknown>).name;
      const value = (property as Record<string, unknown>).value;
      if (
        typeof name === 'string' &&
        /gewicht|menge|inhalt|f[üu]llmenge|weight|volume|net\s*content/i.test(name) &&
        value != null &&
        String(value).trim()
      ) {
        return String(value).trim();
      }
    }
  }

  return null;
}

// Best-effort fallback for the majority of sites with no structured data:
// matches "250 g", "1,5 l", "500ml", "3 x 100 g" etc. Order in the
// alternation matters — "kg"/"ml"/"cl" must be tried before their shorter
// "g"/"l" counterparts so e.g. "500ml" isn't cut short to "500m" + stray "l".
const QUANTITY_PATTERN = /(?:(\d+(?:[.,]\d+)?)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i;

// Many storefronts (Shopify in particular) render the variant/pack size only
// into an inline <script> JSON blob (e.g. `"variant":"60 g"`,
// `"public_title":"60 g"`) rather than as visible page text — stripHtmlToText
// deliberately discards script contents, so that data would otherwise never
// be seen. This matches a JSON string value that is *just* a quantity,
// regardless of which key it sits under, directly against the raw HTML.
const JSON_QUANTITY_VALUE_PATTERN =
  /"(?:(\d+(?:[.,]\d+)?)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)"/i;

function normalizeQuantityMatch(match: RegExpMatchArray): string {
  const [, multiplier, amount, unit] = match;
  const base = `${amount.replace(',', '.')} ${unit.toLowerCase()}`;
  return multiplier ? `${multiplier.replace(',', '.')} x ${base}` : base;
}

function extractQuantity(html: string, jsonLd: JsonLdProduct | null, name: string | null): string | null {
  const fromJsonLd = extractQuantityFromJsonLd(jsonLd);
  if (fromJsonLd) {
    return fromJsonLd;
  }

  const nameMatch = name?.match(QUANTITY_PATTERN);
  if (nameMatch) {
    return normalizeQuantityMatch(nameMatch);
  }

  const jsonMatch = html.match(JSON_QUANTITY_VALUE_PATTERN);
  if (jsonMatch) {
    return normalizeQuantityMatch(jsonMatch);
  }

  const textMatch = stripHtmlToText(html).match(QUANTITY_PATTERN);
  if (textMatch) {
    return normalizeQuantityMatch(textMatch);
  }

  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || url.length === 0) {
      return jsonResponse({ error: 'Feld "url" fehlt oder ist ungültig.' }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return jsonResponse({ error: 'Das ist keine gültige URL.' }, 400);
    }

    let html: string;
    try {
      const pageResponse = await fetch(parsedUrl.toString(), {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (!pageResponse.ok) {
        return jsonResponse(
          { error: `Seite konnte nicht geladen werden (Status ${pageResponse.status}).` },
          502,
        );
      }
      html = await pageResponse.text();
    } catch (fetchError) {
      const detail = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return jsonResponse(
        {
          error:
            `Seite konnte nicht abgerufen werden (Netzwerkfehler: ${detail}). ` +
            'Manche Seiten blockieren automatisierte Zugriffe von Cloud-/Serverless-IP-Bereichen.',
        },
        502,
      );
    }

    const jsonLd = extractJsonLdProduct(html);

    const name =
      (typeof jsonLd?.name === 'string' ? jsonLd.name : null) ??
      extractMetaContent(html, 'og:title') ??
      extractMetaContent(html, 'twitter:title') ??
      extractTitleTag(html);

    if (!name) {
      return jsonResponse({ error: 'Produktname konnte auf dieser Seite nicht gefunden werden.' }, 422);
    }

    const imageUrl =
      extractImageFromJsonLd(jsonLd) ??
      extractMetaContent(html, 'og:image') ??
      extractMetaContent(html, 'twitter:image');

    const brand =
      extractBrandFromJsonLd(jsonLd) ??
      extractMetaContent(html, 'og:site_name') ??
      parsedUrl.hostname.replace(/^www\./, '');

    const description =
      (typeof jsonLd?.description === 'string' ? jsonLd.description : null) ??
      extractMetaContent(html, 'og:description') ??
      extractMetaContent(html, 'description');

    const quantity = extractQuantity(html, jsonLd, name);

    const nutrition = extractNutritionFromJsonLd(jsonLd) ?? extractNutritionFromPageText(html);

    try {
      await registerOrRecheckManufacturer(supabaseAdmin, parsedUrl.hostname.replace(/^www\./, ''));
    } catch (manufacturerError) {
      // Best-effort side collection — must never fail the actual scrape.
      console.error('registerOrRecheckManufacturer failed:', manufacturerError);
    }

    return jsonResponse({
      name,
      brand,
      quantity,
      description,
      imageUrl,
      nutrition,
      sourceUrl: parsedUrl.toString(),
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Scrapen.' },
      500,
    );
  }
});
