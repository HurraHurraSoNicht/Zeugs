import { uploadImage } from './imagesApi';

// Uploads an image (as picked by expo-image-picker, base64 + mime type) to
// the public "article-images" Storage bucket and returns its public URL —
// used for both the article hero image and images inserted into the body
// text (see ArticleEditForm.tsx and supabase/migrations/0008_article_images_
// bucket.sql).
export async function uploadArticleImage(base64: string, mimeType: string): Promise<string> {
  return uploadImage('article-images', base64, mimeType);
}
