-- 0004_product_categories.sql
-- Adds category-membership storage for products, backing the honeycomb
-- navigation on the Home screen (src/data/homeCategories.ts). A product can
-- belong to multiple categories (e.g. a snack that's also a party pick), so
-- this is an array column, not a single foreign key — mirrors the existing
-- `tags` column pattern. Stores category ids ('chilled-frozen', 'pantry',
-- etc.), not the 'all' pseudo-category, since every product implicitly
-- belongs to "Alle Produkte".

alter table public.products
  add column if not exists categories text[] not null default '{}';

create index if not exists products_categories_idx on public.products using gin (categories);
