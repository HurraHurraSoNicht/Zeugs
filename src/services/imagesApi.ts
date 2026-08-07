import { decode } from 'base64-arraybuffer';
import { getSupabase } from './supabaseClient';

// Shared by every "pick an image, upload it, store a URL" flow in the app
// (see articleImagesApi.ts, productImagesApi.ts) — never embed the raw
// base64 directly in a DB text column instead: that column's value tends to
// end up bound to a plain TextInput somewhere (e.g. the "Bild-URL" field),
// and one giant unbroken base64 string can hang the browser's text-layout
// engine on web (confirmed while building the article body image feature).
// A short Storage URL avoids that entirely.
export async function uploadImage(bucket: string, base64: string, mimeType: string): Promise<string> {
  const extension = mimeType.split('/')[1] ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), { contentType: mimeType });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
