-- 0003_product_rating_columns.sql
-- Adds denormalized rating summary columns to products. No rating-submission
-- feature exists in the app yet (the ratings table exists but nothing writes
-- to it), so these simply default to 0 for now. Revisit as a computed
-- aggregate (AVG(stars)/COUNT(*) over ratings) once that feature is built.

alter table public.products
  add column if not exists average_rating real not null default 0;

alter table public.products
  add column if not exists ratings_count integer not null default 0;
