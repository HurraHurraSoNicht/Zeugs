import { uploadImage } from './imagesApi';

// Uploads a product photo (as picked by expo-image-picker, base64 + mime
// type) to the public "product-images" Storage bucket and returns its
// public URL — see ProductEditForm.tsx and supabase/migrations/0010_
// product_images_bucket.sql.
export async function uploadProductImage(base64: string, mimeType: string): Promise<string> {
  return uploadImage('product-images', base64, mimeType);
}
