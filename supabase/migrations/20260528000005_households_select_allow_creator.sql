-- createHousehold() inserts a row with `insert ... returning` (the PostgREST
-- `.select()` chained onto `.insert()`). RETURNING evaluates the households
-- SELECT policy against the new row. Owner membership is created by the
-- on_household_created AFTER INSERT trigger, so is_household_member(id) is not
-- yet satisfiable for the RETURNING read-back -- the insert is rejected with
-- "new row violates row-level security policy for table households" (HTTP 403),
-- which made household creation impossible.
--
-- Allowing the creator to read their own household removes the dependency on the
-- trigger's timing. This does not weaken isolation: the INSERT policy already
-- forces created_by = auth.uid(), so a user can only ever read households they
-- themselves created (plus those they are a member of).
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (created_by = auth.uid() or public.is_household_member(id));
