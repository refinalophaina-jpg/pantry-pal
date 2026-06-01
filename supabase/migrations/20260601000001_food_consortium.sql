-- ============================================================================
-- Food consortium: canonical reference data (ingredients, branded foods,
-- cooking techniques, a public recipe catalog) with full-text + trigram search.
--
-- These are SHARED reference tables, not household data: any authenticated user
-- can read them; only the service role (importers) writes. That keeps the rich
-- corpus open to every household while user data stays RLS-scoped.
-- ============================================================================

create extension if not exists pg_trgm;

-- array_to_string is marked STABLE (conservatively), which blocks its use in a
-- generated column. Joining an array with a constant delimiter is actually
-- deterministic, so wrap it as IMMUTABLE to fold aliases/tags into search.
create or replace function public.immutable_array_to_string(arr text[])
returns text
language sql
immutable
as $$ select array_to_string(arr, ' ') $$;

-- ---------------------------------------------------------------------------
-- Canonical ingredients — the spine of the data layer. One row per real-world
-- ingredient, with aliases for matching, conversion factors, and per-100g
-- nutrition (USDA FoodData Central, public domain).
-- ---------------------------------------------------------------------------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Other',
  aliases text[] not null default '{}',
  -- conversions
  density_g_per_ml numeric,
  grams_per_piece numeric,
  -- per-100g nutrition
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  -- provenance
  source text not null default 'curated',
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector(
      'english'::regconfig,
      coalesce(name, '') || ' ' ||
      coalesce(public.immutable_array_to_string(aliases), '') || ' ' ||
      coalesce(category, '')
    )
  ) stored
);
create index ingredients_search_idx on public.ingredients using gin (search);
create index ingredients_name_trgm_idx on public.ingredients using gin (name gin_trgm_ops);
create index ingredients_category_idx on public.ingredients (category);

create trigger ingredients_updated_at
before update on public.ingredients
for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Branded / packaged foods — barcode catalog (Open Food Facts), optionally
-- linked to a canonical ingredient.
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  name text not null,
  brand text,
  category text not null default 'Other',
  ingredient_id uuid references public.ingredients(id) on delete set null,
  serving_size text,
  -- per-100g nutrition
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  source text not null default 'openfoodfacts',
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector(
      'english'::regconfig,
      coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, '')
    )
  ) stored
);
create index foods_search_idx on public.foods using gin (search);
create index foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);
create index foods_ingredient_idx on public.foods (ingredient_id);

create trigger foods_updated_at
before update on public.foods
for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Cooking techniques / guides — the "learn the craft" layer.
-- ---------------------------------------------------------------------------
create table public.techniques (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'General',
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  minutes int,
  summary text not null,
  body text not null default '',
  tags text[] not null default '{}',
  source text not null default 'curated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector(
      'english'::regconfig,
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' ||
      coalesce(category, '') || ' ' || coalesce(public.immutable_array_to_string(tags), '')
    )
  ) stored
);
create index techniques_search_idx on public.techniques using gin (search);

create trigger techniques_updated_at
before update on public.techniques
for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Public recipe catalog — a shared corpus (distinct from household
-- saved_recipes). Mirrors the client Recipe shape.
-- ---------------------------------------------------------------------------
create table public.recipe_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  cuisine text not null default 'International',
  minutes int not null default 30,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  servings int not null default 2,
  equipment text[] not null default '{}',
  ingredients jsonb not null default '[]'::jsonb,
  steps text[] not null default '{}',
  tags text[] not null default '{}',
  image_url text,
  area text,
  source text not null default 'curated',
  source_id text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector(
      'english'::regconfig,
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' ||
      coalesce(cuisine, '') || ' ' || coalesce(public.immutable_array_to_string(tags), '')
    )
  ) stored
);
create index recipe_catalog_search_idx on public.recipe_catalog using gin (search);
create index recipe_catalog_name_trgm_idx on public.recipe_catalog using gin (name gin_trgm_ops);
create index recipe_catalog_cuisine_idx on public.recipe_catalog (cuisine);

create trigger recipe_catalog_updated_at
before update on public.recipe_catalog
for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public read for authenticated users; writes only via service role.
-- ---------------------------------------------------------------------------
alter table public.ingredients     enable row level security;
alter table public.foods           enable row level security;
alter table public.techniques      enable row level security;
alter table public.recipe_catalog  enable row level security;

create policy ingredients_select on public.ingredients
  for select to authenticated using (true);
create policy foods_select on public.foods
  for select to authenticated using (true);
create policy techniques_select on public.techniques
  for select to authenticated using (true);
create policy recipe_catalog_select on public.recipe_catalog
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Search RPCs — combine prefix, full-text, and trigram similarity so
-- autocomplete is forgiving of typos and word order. search_path includes
-- extensions so similarity() resolves on Supabase (no-op on vanilla pg).
-- ---------------------------------------------------------------------------
create or replace function public.search_ingredients(q text, lim int default 20)
returns setof public.ingredients
language sql
stable
set search_path = public, extensions
as $$
  select *
  from public.ingredients i
  where q is null or btrim(q) = ''
     or i.name ilike '%' || q || '%'
     or i.search @@ plainto_tsquery('english', q)
     or similarity(i.name, q) > 0.2
     or exists (select 1 from unnest(i.aliases) a where a ilike '%' || q || '%')
  order by
    case when i.name ilike q || '%' then 0 else 1 end,
    similarity(i.name, coalesce(q, '')) desc nulls last,
    i.name
  limit greatest(1, least(lim, 50));
$$;

create or replace function public.search_recipe_catalog(q text, lim int default 20)
returns setof public.recipe_catalog
language sql
stable
set search_path = public, extensions
as $$
  select *
  from public.recipe_catalog r
  where q is null or btrim(q) = ''
     or r.name ilike '%' || q || '%'
     or r.search @@ plainto_tsquery('english', q)
     or similarity(r.name, q) > 0.2
  order by
    case when r.name ilike q || '%' then 0 else 1 end,
    similarity(r.name, coalesce(q, '')) desc nulls last,
    r.name
  limit greatest(1, least(lim, 50));
$$;

grant execute on function public.search_ingredients(text, int) to authenticated;
grant execute on function public.search_recipe_catalog(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a license-clean starter set so the tables are useful immediately.
-- Importers (USDA FoodData Central, Open Food Facts) expand these.
-- Nutrition per 100 g, USDA (public domain).
-- ---------------------------------------------------------------------------
insert into public.ingredients
  (slug, name, category, aliases, grams_per_piece, calories, protein_g, carbs_g, fat_g, fiber_g)
values
  ('olive-oil','Olive oil','Oils & Condiments','{oil}',null,884,0,0,100,0),
  ('butter','Butter','Dairy & Eggs','{}',null,717,0.9,0.1,81,0),
  ('egg','Egg','Dairy & Eggs','{eggs}',50,155,13,1.1,11,0),
  ('chicken-breast','Chicken breast','Meat & Seafood','{chicken}',null,165,31,0,3.6,0),
  ('ground-beef','Ground beef','Meat & Seafood','{beef,mince}',null,254,26,0,17,0),
  ('salmon','Salmon','Meat & Seafood','{}',null,208,20,0,13,0),
  ('shrimp','Shrimp','Meat & Seafood','{prawns}',null,99,24,0.2,0.3,0),
  ('rice','Rice','Grains & Bread','{white rice}',null,130,2.7,28,0.3,0.4),
  ('pasta','Pasta','Grains & Bread','{spaghetti,noodles}',null,158,5.8,31,0.9,1.8),
  ('bread','Bread','Grains & Bread','{}',null,265,9,49,3.2,2.7),
  ('flour','Flour','Grains & Bread','{all-purpose flour}',null,364,10,76,1,2.7),
  ('milk','Milk','Dairy & Eggs','{whole milk}',null,60,3.2,4.6,3.3,0),
  ('greek-yogurt','Greek yogurt','Dairy & Eggs','{yogurt}',null,59,10,3.6,0.4,0),
  ('cheddar','Cheddar','Dairy & Eggs','{cheese}',null,403,25,1.3,33,0),
  ('tomato','Tomato','Produce','{tomatoes}',120,18,0.9,3.9,0.2,1.2),
  ('onion','Onion','Produce','{onions}',110,40,1.1,9,0.1,1.7),
  ('garlic','Garlic','Produce','{}',3,149,6.4,33,0.5,2.1),
  ('potato','Potato','Produce','{potatoes}',150,77,2,17,0.1,2.2),
  ('carrot','Carrot','Produce','{carrots}',60,41,0.9,10,0.2,2.8),
  ('spinach','Spinach','Produce','{}',null,23,2.9,3.6,0.4,2.2),
  ('bell-pepper','Bell pepper','Produce','{pepper,capsicum}',150,31,1,6,0.3,2.1),
  ('banana','Banana','Produce','{bananas}',120,89,1.1,23,0.3,2.6),
  ('lemon','Lemon','Produce','{lemons}',60,29,1.1,9,0.3,2.8),
  ('black-beans','Black beans','Legumes & Nuts','{beans}',null,132,8.9,24,0.5,8.7),
  ('chickpeas','Chickpeas','Legumes & Nuts','{garbanzo beans}',null,164,8.9,27,2.6,7.6),
  ('lentils','Lentils','Legumes & Nuts','{}',null,116,9,20,0.4,7.9),
  ('almonds','Almonds','Legumes & Nuts','{}',null,579,21,22,50,12),
  ('peanut-butter','Peanut butter','Legumes & Nuts','{}',null,588,25,20,50,6),
  ('soy-sauce','Soy sauce','Oils & Condiments','{}',null,53,8,4.9,0.6,0.8),
  ('honey','Honey','Pantry & Spices','{}',null,304,0.3,82,0,0.2),
  ('sugar','Sugar','Pantry & Spices','{}',null,387,0,100,0,0),
  ('salt','Salt','Pantry & Spices','{}',null,0,0,0,0,0)
on conflict (slug) do nothing;

insert into public.techniques (slug, title, category, difficulty, minutes, summary, tags)
values
  ('blanching','Blanching','Vegetables','easy',10,
   'Briefly boil vegetables, then plunge into ice water to set colour and stop cooking.',
   '{vegetables,prep,boil}'),
  ('searing','Searing','Heat & Protein','medium',15,
   'Brown protein in a very hot pan to build deep flavour via the Maillard reaction.',
   '{protein,heat,maillard}'),
  ('julienne','Julienne cut','Knife Skills','medium',10,
   'Cut vegetables into thin, even matchsticks for fast, uniform cooking.',
   '{knife,prep,cuts}'),
  ('steaming','Steaming','Vegetables','easy',15,
   'Cook over simmering water with gentle moist heat that preserves nutrients and colour.',
   '{vegetables,moist-heat,healthy}'),
  ('caramelizing-onions','Caramelizing onions','Aromatics','easy',40,
   'Cook sliced onions low and slow until deeply golden and sweet.',
   '{aromatics,low-and-slow}')
on conflict (slug) do nothing;
