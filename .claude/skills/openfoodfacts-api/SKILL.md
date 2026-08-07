---
name: openfoodfacts-api
description: How to query the Open Food Facts API for product name/brand/image/nutrition data (barcode lookup + text search). Use whenever integrating product import/lookup for this app, instead of scraping arbitrary retailer/brand websites (which get blocked by WAFs/bot protection — see the scrape-product Edge Function's known limitations). Also use when debugging "product not found" or rate-limit issues against this API.
---

# Open Food Facts API

Free, public, purpose-built database for exactly the fields this app needs
(name, brand, image, nutrition). Prefer this over scraping arbitrary retailer
URLs — retailer/brand sites (Volvic, Ritter Sport, ...) commonly block
automated requests (see `scrape-product` Edge Function notes); Open Food
Facts is designed to be queried programmatically and has no such blocking.

## Can be called directly from the client — no Edge Function needed

Confirmed via a live request: the API responds with
`Access-Control-Allow-Origin: *`. That means `fetch()` works directly from
the Expo app (web AND native), no Supabase Edge Function proxy required for
this data source. Only set a descriptive `User-Agent` header — no API key.

```
User-Agent: Zeugs/1.0 (contact@example.com)
```

## Endpoints

### 1. Product by barcode (primary — use this whenever a barcode/EAN/GTIN is known)

```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=product_name,brands,image_url,nutriments,labels_tags,quantity
```

Verified query params:
- `fields` — comma-separated field list, always pass this to keep the response small (the full product object is huge)
- `lc` — language code (e.g. `de`), affects which localized name variant is preferred

Response shape (verified against real barcodes `3017620422003` = Nutella and
`4000417675217` = Ritter Sport "81% Die Intensive"):

```json
{
  "code": "4000417675217",
  "status": 1,
  "product": {
    "product_name": "81% Die Intensive – Edelkakao Klasse",
    "brands": "Ritter Sport",
    "image_url": "https://images.openfoodfacts.org/images/products/400/041/767/5217/front_de.4.400.jpg",
    "quantity": "75g",
    "labels_tags": ["en:no-gluten"],
    "nutriments": {
      "energy-kcal_100g": 605,
      "energy-kj_100g": 2397,
      "fat_100g": 51,
      "saturated-fat_100g": 32,
      "carbohydrates_100g": 20,
      "sugars_100g": 16,
      "fiber_100g": null,
      "proteins_100g": 10,
      "salt_100g": 0.02
    }
  }
}
```

`status: 0` (instead of `1`) means the barcode wasn't found — check that
before reading `product`, it will be absent/null.

### Field mapping to this app's types (`src/types/product.ts`, `src/types/nutrition.ts`)

| Open Food Facts field | App field |
|---|---|
| `product.product_name` (or `product_name_<lc>`) | `name` |
| `product.brands` (comma-separated; first segment is usually enough) | `brand` |
| `product.image_url` | `imageUrl` |
| `product.labels_tags` (strip `en:` prefix) | `tags` |
| `product.nutriments["energy-kcal_100g"]` | `nutrition.energyKcal` |
| `product.nutriments["energy-kj_100g"]` | `nutrition.energyKj` |
| `product.nutriments["fat_100g"]` | `nutrition.fat` |
| `product.nutriments["saturated-fat_100g"]` | `nutrition.saturatedFat` |
| `product.nutriments["carbohydrates_100g"]` | `nutrition.carbohydrates` |
| `product.nutriments["sugars_100g"]` | `nutrition.sugars` |
| `product.nutriments["fiber_100g"]` | `nutrition.fiber` (often absent — treat as null) |
| `product.nutriments["proteins_100g"]` | `nutrition.protein` |
| `product.nutriments["salt_100g"]` | `nutrition.salt` |

### 2. Text search (primary in this app — no barcodes available for our products)

**Use the legacy endpoint — it's the one actually verified to work with `search_terms`:**

```
GET https://world.openfoodfacts.org/cgi/search.pl?search_terms=...&json=1&page_size=10&fields=product_name,brands,code,image_url
```

Verified query params: `search_terms`, `json=1` (required or you get HTML back), `page_size`, `fields`.

Example real result for `search_terms=ritter+sport+intensive`:
```json
{"count":1,"products":[{"brands":"Ritter Sport","code":"4000417675217","product_name":"81% Die Intensive – Edelkakao Klasse", ...}]}
```

**`/api/v2/search` is NOT a drop-in replacement — do not use it with `search_terms`.**
An earlier version of this skill recommended `/api/v2/search?search_terms=...`
as "the newer, recommended" endpoint based on the docs alone, without having
actually verified a real query against it (the first live attempt got
rate-limited before returning content). When later tried for real in the app
with `search_terms=Ritter Sport Intensive`, it returned completely unrelated
products (random water/dairy items) — it evidently does not honor
`search_terms` the way `cgi/search.pl` does (it's a newer
"Search-a-licious"-style API with a different query contract that wasn't
worked out here). **Lesson: don't trust an untested "recommended" endpoint
from docs over one you've actually confirmed returns correct results** — if
you want to try `/api/v2/search` again, verify its actual parameter name(s)
against the live API with a known-answer query before relying on it, the
same way `cgi/search.pl` was verified here.

Docs also list `page`, `sort_by`, and faceted filters
(`tagtype_0`/`tag_contains_0`/`tag_0`) for `cgi/search.pl` — not re-verified
live here (see rate-limit gotcha below); check
https://openfoodfacts.github.io/openfoodfacts-server/api/ if needed.

## Rate-limit gotcha (important — hit this live while building this skill)

The **search endpoints are much stricter** than the barcode endpoint. After
just 2-3 rapid manual test requests to `cgi/search.pl` / `api/v2/search`,
the API started returning an HTML "Page temporarily unavailable" (503-style)
page instead of JSON for **all** search-endpoint requests from that IP —
this lasted roughly 30-60 seconds before clearing. The barcode endpoint
(`/api/v2/product/{barcode}.json`) kept working fine throughout, unaffected.

**Update:** after a session with many cumulative test requests (curl +
browser, across search, product-by-barcode, and the entry-dates facet),
`cgi/search.pl` kept returning 503 for **over 90 seconds**, well past the
~30-60s recovery seen on earlier, lighter test days. The app's
client-side cooldown was shortened from 60s to 20s
(`SEARCH_COOLDOWN_SECONDS` in `src/screens/AdminScreen.tsx`) on the
assumption that normal single-user usage (one manual search, read results,
maybe another later) stays under whatever the real threshold is — but this
wasn't independently confirmed live, because by that point this session's
IP was already past whatever threshold triggers the longer block. If 20s
starts producing repeated "Netzwerkfehler" in real use, that's the likely
explanation — raise `SEARCH_COOLDOWN_SECONDS` back toward 60s, don't assume
the mechanism itself is broken (the cooldown timer/UI logic itself is
correct and was verified working — counts down, disables/re-enables the
button, restarts after every attempt regardless of success/failure).

Implications for this app:
- Prefer barcode lookup wherever a barcode is available (product packaging,
  user-entered EAN) — don't default to search-first.
- If implementing search, throttle client-side (debounce, don't fire on
  every keystroke) and handle a non-JSON/HTML response gracefully (check
  `Content-Type` or try/catch the `JSON.parse`) rather than assuming every
  response is valid JSON.
- **From a browser client specifically, the rate-limit page surfaced as an
  opaque `fetch()` network failure, not a readable response** — in the app
  (`src/services/openFoodFacts.ts`), a rate-limited request threw before
  reaching the JSON.parse fallback, showing as "Netzwerkfehler" even though
  the same URL fetched fine via curl moments later. Root cause not fully
  confirmed (plausibly the block page lacks CORS headers, unlike normal
  200 responses which do send `Access-Control-Allow-Origin: *`) — but the
  practical takeaway holds either way: don't assume a "Netzwerkfehler" from
  this service means the network/endpoint is broken; it may just mean the
  rate limit was hit seconds earlier. Wait ~60s and retry before debugging
  further.
- Don't loop/retry search rapidly when testing manually — wait at least
  ~60s between manual test batches or you'll reproduce this block.

## Filtering by date (NOT verified — hit a wall testing this)

Open Food Facts has a dedicated "entry dates" facet for browsing products by
the date they were first added:

```
GET https://world.openfoodfacts.org/entry-dates/{YYYY-MM-DD}.json
```
(redirects 301 to `/facets/entry-dates/{YYYY-MM-DD}.json`)

**Could not get a successful response** — got the "Page temporarily
unavailable" block twice in a row (once immediately, once after waiting
60s), unlike `cgi/search.pl` and the barcode endpoint which recovered
quickly from rate limits earlier. The block page's own text hints at a
second possible cause beyond rate-limiting: *"or the page you requested is
not available to anonymous users"* — this facet-browsing feature may
require a registered/authenticated request, unlike the search and
product-by-barcode endpoints verified elsewhere in this skill. Not
confirmed either way; don't assume this endpoint works for anonymous app
users without testing it again with a longer cooldown first.

**Known-working workaround:** every product carries a `created_t` field
(unix timestamp of when it was added) that IS returnable via the ordinary
`fields` parameter on both `cgi/search.pl` and
`/api/v2/product/{barcode}.json` (both already verified reliable above). To
find "products added today," search/filter by whatever criteria you have
(brand, category, text) with `created_t` included in `fields`, then compare
the returned timestamp against today's date **client-side** — rather than
relying on server-side date filtering.

## Relationship to the scrape-product Edge Function

This API is a separate, additive data source — it does not replace
`supabase/functions/scrape-product/index.ts`, which stays for arbitrary
URLs without a known barcode. Prefer Open Food Facts when a barcode is
available; fall back to the scraper (accepting it may fail on protected
brand sites) otherwise.
