-- 0015_profile_images_bucket.sql
-- Storage bucket for the profile picture uploaded on the Profil-Seite (see
-- "Profilbild hochladen" in ProfileScreen.tsx) — mirrors 0010_product_
-- images_bucket.sql / 0008_article_images_bucket.sql (same reasoning: a
-- short Storage URL instead of an embedded base64 string).
--
-- Public bucket, open inserts: same "no auth system yet" posture as the
-- other image buckets — anyone can upload, nothing sensitive is stored.
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

create policy "profile images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "anyone can upload profile images"
  on storage.objects for insert
  with check (bucket_id = 'profile-images');
