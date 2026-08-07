import type { NutritionFacts } from '../types/nutrition';
import type { Product } from '../types/product';

const USER_AGENT = 'Zeugs/1.0 (contact@example.com)';

export interface OpenFoodFactsSearchResult {
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
}

interface RawSearchProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
}

interface RawNutriments {
  'energy-kcal_100g'?: number;
  'energy-kj_100g'?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  fiber_100g?: number;
  proteins_100g?: number;
  salt_100g?: number;
}

interface RawProduct {
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  labels_tags?: string[];
  nutriments?: RawNutriments;
}

// The search endpoints rate-limit much more aggressively than the barcode
// endpoint and reply with an HTML "temporarily unavailable" page (not JSON)
// once triggered — detect that via a failed JSON.parse rather than crashing.
async function fetchJson(url: string): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch {
    throw new Error('Open Food Facts konnte nicht erreicht werden (Netzwerkfehler).');
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Open Food Facts ist gerade überlastet — bitte kurz warten und erneut versuchen.');
  }
}

function firstBrand(brands: string | undefined): string | null {
  if (!brands) {
    return null;
  }
  return brands.split(',')[0].trim() || null;
}

export async function searchProducts(query: string): Promise<OpenFoodFactsSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
    '&json=1&page_size=10&fields=product_name,brands,code,image_url';
  const json = await fetchJson(url);
  const products: RawSearchProduct[] = json.products ?? [];
  return products
    .filter((product): product is RawSearchProduct & { code: string; product_name: string } =>
      Boolean(product.code && product.product_name),
    )
    .map((product) => ({
      code: product.code,
      name: product.product_name,
      brand: firstBrand(product.brands),
      imageUrl: product.image_url ?? null,
    }));
}

function toNutritionFacts(nutriments: RawNutriments | undefined): NutritionFacts | null {
  if (!nutriments || Object.keys(nutriments).length === 0) {
    return null;
  }
  return {
    energyKcal: nutriments['energy-kcal_100g'] ?? null,
    energyKj: nutriments['energy-kj_100g'] ?? null,
    fat: nutriments.fat_100g ?? null,
    saturatedFat: nutriments['saturated-fat_100g'] ?? null,
    carbohydrates: nutriments.carbohydrates_100g ?? null,
    sugars: nutriments.sugars_100g ?? null,
    fiber: nutriments.fiber_100g ?? null,
    protein: nutriments.proteins_100g ?? null,
    salt: nutriments.salt_100g ?? null,
  };
}

function generateId(): string {
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getProductByBarcode(barcode: string): Promise<Product> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
    '?fields=product_name,brands,quantity,image_url,nutriments,labels_tags';
  const json = await fetchJson(url);
  if (json.status !== 1 || !json.product) {
    throw new Error('Produkt wurde bei Open Food Facts nicht gefunden.');
  }
  const raw: RawProduct = json.product;
  if (!raw.product_name) {
    throw new Error('Produktname fehlt in den Open-Food-Facts-Daten.');
  }

  return {
    id: generateId(),
    name: raw.product_name,
    brand: firstBrand(raw.brands),
    quantity: raw.quantity?.trim() || null,
    description: null,
    imageUrl: raw.image_url ?? null,
    source: 'openfoodfacts',
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    category: null,
    discoveredAt: new Date().toISOString(),
    averageRating: 0,
    ratingsCount: 0,
    tags: (raw.labels_tags ?? []).map((tag) => tag.replace(/^en:/, '')),
    categories: [],
    nutrition: toNutritionFacts(raw.nutriments),
  };
}
