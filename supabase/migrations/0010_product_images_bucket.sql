-- 0010_product_images_bucket.sql
-- Storage bucket for product photos uploaded via the "Bild hochladen"
-- button in ProductEditForm.tsx — mirrors 0008_article_images_bucket.sql
-- (same reasoning: a base64 data URI embedded directly in the "Bild-URL"
-- TextInput can hang the browser's text-layout engine for anything but a
-- tiny image; a short Storage URL avoids that).
--
-- Public bucket, open inserts: same "no auth system yet" posture as the
-- other tables/buckets — anyone can upload, nothing sensitive is stored.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "anyone can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');
