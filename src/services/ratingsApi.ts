import { getSupabase } from './supabaseClient';

export interface RatingSummary {
  averageRating: number;
  ratingsCount: number;
}

// Fetches the current device's own vote for a product, if any — lets the
// UI show/highlight what you previously voted so "changing" it is legible.
export async function fetchMyRating(productId: string, deviceId: string): Promise<number | null> {
  const { data, error } = await getSupabase()
    .from('product_ratings')
    .select('stars')
    .eq('product_id', productId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data?.stars ?? null;
}

// Casts or overwrites this device's vote (upsert on the product_id+device_id
// unique constraint), then reads back the product's freshly recomputed
// average_rating/ratings_count (kept in sync by a DB trigger — see
// supabase/migrations/0005_product_ratings.sql).
export async function submitRating(
  productId: string,
  deviceId: string,
  stars: number,
): Promise<RatingSummary> {
  const supabase = getSupabase();

  const { error: upsertError } = await supabase
    .from('product_ratings')
    .upsert({ product_id: productId, device_id: deviceId, stars }, { onConflict: 'product_id,device_id' });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data, error } = await supabase
    .from('products')
    .select('average_rating, ratings_count')
    .eq('id', productId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { averageRating: data.average_rating, ratingsCount: data.ratings_count };
}
