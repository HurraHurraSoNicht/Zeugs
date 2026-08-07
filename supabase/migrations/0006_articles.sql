-- 0006_articles.sql
-- Magazine content for the "Snack-e-zine" tab (see src/screens/SnackEZineScreen.tsx):
-- a simple hand-authored articles table, mirroring the products table's
-- write model — publicly readable, writes only via a service-role Edge
-- Function (admin-articles), never directly by anon/authenticated.
-- `tags` mirrors products.tags: clustering/filtering by tag is a later
-- feature, but the column exists now so articles can already carry them.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  teaser text,
  image_url text,
  tags text[] not null default '{}',
  published_at timestamptz not null default now()
);

create index if not exists articles_published_at_idx on public.articles (published_at desc);
create index if not exists articles_tags_idx on public.articles using gin (tags);

alter table public.articles enable row level security;

create policy "articles are publicly readable"
  on public.articles for select
  using (true);
