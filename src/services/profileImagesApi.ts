import { uploadImage } from './imagesApi';

// Uploads a profile picture (as picked + resized to max 300x300, base64 +
// mime type) to the public "profile-images" Storage bucket and returns its
// public URL — see ProfileScreen.tsx and supabase/migrations/0015_
// profile_images_bucket.sql.
export async function uploadProfileImage(base64: string, mimeType: string): Promise<string> {
  return uploadImage('profile-images', base64, mimeType);
}
