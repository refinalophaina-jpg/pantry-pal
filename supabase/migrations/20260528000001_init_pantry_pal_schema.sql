-- Households + membership
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

create table public.household_invites (
  code text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id),
  used_at timestamptz
);
create index on public.household_invites (household_id);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  quantity numeric not null default 1,
  unit text not null default 'pcs',
  zone text not null default 'pantry' check (zone in ('pantry','fridge','freezer')),
  expires_on date,
  added_on date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index on public.pantry_items (household_id);
create index on public.pantry_items (household_id, expires_on);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'pcs',
  category text not null default 'Other',
  done boolean not null default false,
  from_recipe text,
  deal_price numeric,
  deal_store text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.shopping_items (household_id);

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  recipe_id text not null,
  recipe_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.meal_plan (household_id, date);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid,
  item_name text not null,
  quantity numeric not null,
  unit text not null,
  reason text not null check (reason in ('used','wasted')),
  at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index on public.usage_events (household_id, at desc);

create table public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  cuisine text,
  minutes int,
  difficulty text check (difficulty in ('easy','medium','hard')),
  servings int,
  equipment text[] default '{}',
  ingredients jsonb not null default '[]'::jsonb,
  steps text[] default '{}',
  tags text[] default '{}',
  external_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.saved_recipes (household_id);

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = hid and hm.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_household_created
after insert on public.households
for each row execute function public.handle_new_household();

create or replace function public.create_household_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of household';
  end if;
  v_code := upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), 1, 8));
  insert into public.household_invites (code, household_id, created_by, expires_at)
  values (v_code, p_household_id, auth.uid(), now() + interval '7 days');
  return v_code;
end;
$$;

create or replace function public.redeem_household_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.household_invites;
begin
  select * into v_invite from public.household_invites
   where code = upper(p_code)
     and used_by is null
     and expires_at > now()
   for update;

  if v_invite.code is null then
    raise exception 'invalid or expired invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.household_invites
     set used_by = auth.uid(), used_at = now()
   where code = v_invite.code;

  return v_invite.household_id;
end;
$$;

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pantry_items_updated_at
before update on public.pantry_items
for each row execute function public.tg_set_updated_at();

alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.household_invites     enable row level security;
alter table public.pantry_items          enable row level security;
alter table public.shopping_items        enable row level security;
alter table public.meal_plan             enable row level security;
alter table public.usage_events          enable row level security;
alter table public.saved_recipes         enable row level security;

create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_insert on public.households
  for insert to authenticated with check (created_by = auth.uid());
create policy households_update on public.households
  for update to authenticated using (public.is_household_member(id));
create policy households_delete on public.households
  for delete to authenticated using (
    exists (select 1 from public.household_members hm
            where hm.household_id = id and hm.user_id = auth.uid() and hm.role = 'owner')
  );

create policy hm_select on public.household_members
  for select to authenticated using (
    user_id = auth.uid() or public.is_household_member(household_id)
  );

create policy invites_select on public.household_invites
  for select to authenticated using (public.is_household_member(household_id));

create policy pantry_all on public.pantry_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy shopping_all on public.shopping_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy meal_plan_all on public.meal_plan
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy usage_all on public.usage_events
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy saved_recipes_all on public.saved_recipes
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

alter publication supabase_realtime add table
  public.pantry_items,
  public.shopping_items,
  public.meal_plan,
  public.usage_events,
  public.saved_recipes,
  public.household_members,
  public.household_invites;
