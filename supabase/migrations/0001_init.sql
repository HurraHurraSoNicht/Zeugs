-- 0001_init.sql
-- Initial schema for Lebensmittel-Produktentdeckung
-- Tables: profiles, products, ratings, comments
-- Includes RLS policies and an auth.users -> profiles sync trigger.

-- Extensions -----------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- profiles ---------------------------------------------------------------
-- One row per Supabase Auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- products -----------------------------------------------------------------
-- Products imported automatically from external APIs / scraping sources.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  description text,
  image_url text,
  source text,        -- e.g. 'openfoodfacts', 'scraper:some-site'
  source_url text,     -- original URL/reference at the source
  category text,
  discovered_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_discovered_at_idx on public.products (discovered_at desc);

-- ratings --------------------------------------------------------------------
-- One star rating (1-5) per user per product.
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists ratings_product_id_idx on public.ratings (product_id);
create index if not exists ratings_user_id_idx on public.ratings (user_id);

-- comments -------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_product_id_idx on public.comments (product_id);
create index if not exists comments_user_id_idx on public.comments (user_id);

-- auth.users -> profiles sync -------------------------------------------------
-- Automatically create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security -----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;

-- profiles: readable by anyone, editable only by the owner.
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- products: publicly readable. Writes happen via backend import jobs using the
-- service role key, which bypasses RLS, so no insert/update/delete policy is
-- granted to anon/authenticated roles here.
create policy "products are publicly readable"
  on public.products for select
  using (true);

-- ratings: publicly readable; a user may only create/modify/delete their own rating.
create policy "ratings are publicly readable"
  on public.ratings for select
  using (true);

create policy "users can insert their own rating"
  on public.ratings for insert
  with check (auth.uid() = user_id);

create policy "users can update their own rating"
  on public.ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own rating"
  on public.ratings for delete
  using (auth.uid() = user_id);

-- comments: publicly readable; a user may only create/modify/delete their own comment.
create policy "comments are publicly readable"
  on public.comments for select
  using (true);

create policy "users can insert their own comment"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "users can update their own comment"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own comment"
  on public.comments for delete
  using (auth.uid() = user_id);
