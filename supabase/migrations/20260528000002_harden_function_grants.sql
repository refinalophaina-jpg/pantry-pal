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

revoke execute on function public.is_household_member(uuid) from anon, authenticated, public;
revoke execute on function public.handle_new_household() from anon, authenticated, public;
revoke execute on function public.tg_set_updated_at() from anon, authenticated, public;

revoke execute on function public.create_household_invite(uuid) from anon, public;
revoke execute on function public.redeem_household_invite(text) from anon, public;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.redeem_household_invite(text) to authenticated;
