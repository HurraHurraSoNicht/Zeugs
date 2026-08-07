-- 0005_product_ratings.sql
-- Anonymous, device-scoped star ratings (1-5). The app has no login system,
-- so instead of the auth-tied `ratings` table from 0001 (which needs a real
-- profiles/auth.users row per voter and nothing has ever written to it),
-- votes are keyed by a client-generated device id persisted in
-- AsyncStorage — one vote per device per product, overwritable by voting
-- again (upsert on product_id+device_id).
create table if not exists public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  device_id text not null,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, device_id)
);

create index if not exists product_ratings_product_id_idx on public.product_ratings (product_id);

alter table public.product_ratings enable row level security;

-- Publicly readable/writable: there's no auth system to check ownership
-- against, so anyone can cast or change "their" (device-scoped) vote.
create policy "product ratings are publicly readable"
  on public.product_ratings for select
  using (true);

create policy "anyone can cast a rating"
  on public.product_ratings for insert
  with check (true);

create policy "anyone can change their own rating"
  on public.product_ratings for update
  using (true)
  with check (true);

create or replace function public.touch_product_ratings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_product_ratings_updated_at on public.product_ratings;
create trigger set_product_ratings_updated_at
  before update on public.product_ratings
  for each row execute function public.touch_product_ratings_updated_at();

-- Recomputes products.average_rating/ratings_count (added as static-default
-- placeholders in 0003, pending "a computed aggregate ... once that feature
-- is built") from product_ratings whenever a vote is cast, changed, or
-- removed. security definer so it can write to products despite that
-- table's anon/authenticated write lockdown (see 0001) — a narrow,
-- purpose-built exception, not a general bypass.
create or replace function public.recompute_product_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products
  set
    average_rating = coalesce(
      (select avg(stars)::real from public.product_ratings where product_id = target_product_id),
      0
    ),
    ratings_count = (
      select count(*) from public.product_ratings where product_id = target_product_id
    )
  where id = target_product_id;

  return null;
end;
$$;

drop trigger if exists on_product_rating_change on public.product_ratings;
create trigger on_product_rating_change
  after insert or update or delete on public.product_ratings
  for each row execute function public.recompute_product_rating();
