-- 0008_article_images_bucket.sql
-- Storage bucket for images embedded inline in article body text (see the
-- "Bild einfügen" toolbar button in ArticleEditForm.tsx). Earlier this
-- embedded the picked image directly as a base64 data URI in the markdown
-- body — for anything but a tiny image, that puts one giant unbroken
-- string inside a plain multiline TextInput (a real <textarea> on web),
-- which can hang the browser's text-layout engine. Uploading to Storage
-- and referencing a normal (short) URL instead avoids that entirely, and
-- keeps the articles.body column from ballooning in size.
--
-- Public bucket, open inserts: same "no auth system yet" posture as
-- product_ratings (0005) — anyone can upload, nothing sensitive is stored.
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

create policy "article images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'article-images');

create policy "anyone can upload article images"
  on storage.objects for insert
  with check (bucket_id = 'article-images');
