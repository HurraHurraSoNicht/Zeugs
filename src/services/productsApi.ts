import { extractFunctionError, getSupabase } from './supabaseClient';
import type { Product } from '../types/product';

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  description: string | null;
  image_url: string | null;
  source: string | null;
  source_url: string | null;
  category: string | null;
  discovered_at: string;
  average_rating: number;
  ratings_count: number;
  tags: string[] | null;
  categories: string[] | null;
  nutrition: Product['nutrition'];
}

function rowToProduct(row: ProductRow): Product {
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

// Reads are publicly allowed by RLS (see supabase/migrations/0001_init.sql),
// so this goes straight to the table with the anon key.
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .order('discovered_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data as ProductRow[]).map(rowToProduct);
}

// Writes go through the admin-products Edge Function (service role key) —
// RLS blocks inserts/deletes for the anon key on purpose, see that
// migration's comments and the admin-products function's header.
export async function insertProduct(product: Product): Promise<Product> {
  const { data, error } = await getSupabase().functions.invoke('admin-products', {
    body: {
      name: product.name,
      brand: product.brand,
      quantity: product.quantity,
      description: product.description,
      imageUrl: product.imageUrl,
      source: product.source,
      sourceUrl: product.sourceUrl,
      category: product.category,
      tags: product.tags,
      categories: product.categories,
      nutrition: product.nutrition,
    },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  return data as Product;
}

export async function updateProduct(id: string, product: Product): Promise<Product> {
  const { data, error } = await getSupabase().functions.invoke('admin-products', {
    method: 'PUT',
    body: {
      id,
      name: product.name,
      brand: product.brand,
      quantity: product.quantity,
      description: product.description,
      imageUrl: product.imageUrl,
      source: product.source,
      sourceUrl: product.sourceUrl,
      category: product.category,
      tags: product.tags,
      categories: product.categories,
      nutrition: product.nutrition,
    },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('admin-products', {
    method: 'DELETE',
    body: { id },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
}
