alter table public.saved_recipes
  add column image_url text,
  add column area text,
  add column source text,
  add column video text,
  add column calories integer,
  add column protein_g numeric,
  add column carbs_g numeric,
  add column fat_g numeric,
  add column updated_at timestamptz not null default now();

create trigger saved_recipes_updated_at
before update on public.saved_recipes
for each row execute function public.tg_set_updated_at();

create index on public.saved_recipes (household_id, area);

create table public.nutrition_cache (
  key text primary key,
  display_name text not null,
  source text not null,
  source_id text,
  per_unit text not null default '100g',
  calories numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  fetched_at timestamptz not null default now()
);

alter table public.nutrition_cache enable row level security;
create policy nutrition_cache_select on public.nutrition_cache
  for select to authenticated using (true);
