// Shared "download an external product image and re-host it in our own
// Storage bucket" logic — used by admin-products (every insert/update) and
// migrate-product-images (the one-off backfill for products saved before
// this existed). See admin-products/index.ts's header comment for the "why".

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const IMAGE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

export function isOwnStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/product-images/");
}

// Some CDNs serve real images under a generic/wrong Content-Type (seen on
// knuspr.de: a valid JPEG served as "application/octet-stream") — fall back
// to guessing from the URL's file extension rather than discarding a
// perfectly good image over a mislabeled header.
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

function guessContentTypeFromUrl(url: string): string | null {
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  const extension = match?.[1]?.toLowerCase();
  return extension ? (EXTENSION_TO_CONTENT_TYPE[extension] ?? null) : null;
}

export async function rehostImageUrl(
  supabaseAdmin: SupabaseClient,
  imageUrl: string | null,
): Promise<string | null> {
  if (!imageUrl || isOwnStorageUrl(imageUrl)) {
    return imageUrl ?? null;
  }

  try {
    const response = await fetch(imageUrl, {
      headers: IMAGE_FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`Bild-Rehosting: Status ${response.status} für ${imageUrl}`);
      return imageUrl;
    }

    let contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!contentType.startsWith("image/")) {
      const guessed = guessContentTypeFromUrl(imageUrl);
      if (!guessed) {
        console.error(`Bild-Rehosting: kein Bild-Content-Type ("${contentType}") für ${imageUrl}`);
        return imageUrl;
      }
      contentType = guessed;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const extension = contentType.split("/")[1] || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { contentType });
    if (uploadError) {
      console.error("Bild-Rehosting: Upload fehlgeschlagen:", uploadError.message);
      return imageUrl;
    }

    const { data } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    console.error("Bild-Rehosting fehlgeschlagen:", error);
    return imageUrl;
  }
}
