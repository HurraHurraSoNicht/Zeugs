import { extractFunctionError, getSupabase } from './supabaseClient';
import type { NutritionFacts } from '../types/nutrition';
import type { Product } from '../types/product';

interface ScrapeProductResponse {
  name: string;
  brand: string | null;
  quantity: string | null;
  description: string | null;
  imageUrl: string | null;
  nutrition: NutritionFacts | null;
  sourceUrl: string;
}

function generateId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Delegates the actual fetch+parse to the "scrape-product" Supabase Edge
// Function so it runs server-to-server (no browser CORS) and works the same
// on web and native. Requires a real Supabase project (see .env.example) with
// that function deployed.
export async function scrapeProductFromUrl(url: string): Promise<Product> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Das ist keine gültige URL.');
  }

  const { data, error } = await getSupabase().functions.invoke<ScrapeProductResponse>('scrape-product', {
    body: { url: parsedUrl.toString() },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  if (!data || typeof data.name !== 'string') {
    throw new Error('Ungültige Antwort vom Scraper.');
  }

  return {
    id: generateId(),
    name: data.name,
    brand: data.brand,
    quantity: data.quantity,
    description: data.description,
    imageUrl: data.imageUrl,
    source: 'scraper:edge-function',
    sourceUrl: data.sourceUrl,
    category: null,
    discoveredAt: new Date().toISOString(),
    averageRating: 0,
    ratingsCount: 0,
    tags: [],
    categories: [],
    nutrition: data.nutrition,
  };
}
