-- 0002_product_details.sql
-- Adds fields needed for the product detail page:
-- tags (product labels like "vegan", "bio") and structured nutrition facts.

alter table public.products
  add column if not exists tags text[] not null default '{}'::text[];

alter table public.products
  add column if not exists nutrition jsonb;

create index if not exists products_tags_idx on public.products using gin (tags);
