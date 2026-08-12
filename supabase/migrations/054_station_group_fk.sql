-- Station groups keyed by id instead of matched by name.
--
-- Before: organizations.station_group held a TEXT group name, and station_groups was unique
-- per (owner_id, name). Two admins could each own a group called "Lagos", the text sitting on
-- a station matched neither of them in particular, and deleting one admin's "Lagos" unset the
-- stations belonging to the other's. Cleanup on delete was also done in a route handler, which
-- meant it only ran when that handler ran.
--
-- After: organizations.station_group_id references station_groups(id) ON DELETE SET NULL. The
-- link is exact, and cleanup happens in the database whatever deletes the row.
--
-- organizations.station_group (text) is LEFT IN PLACE deliberately. Dropping it here breaks the
-- running app for the window between this migration and the deploy that stops reading it.
-- Application code stops reading and writing it from that deploy on; drop it in a later
-- migration once this is live and settled.

begin;

-- 1. Groups become platform-wide, because the admin screen that manages them manages every
--    station on the platform rather than the admin's own. A global unique name needs the
--    per-owner duplicates collapsed first: keep the oldest row for each name, with id breaking
--    any tie on created_at so the comparison is a total order and one row always survives.
delete from public.station_groups g
using public.station_groups keep
where g.name = keep.name
  and (g.created_at, g.id) > (keep.created_at, keep.id);

alter table public.station_groups drop constraint if exists station_groups_owner_id_name_key;
alter table public.station_groups alter column owner_id drop not null;

create unique index if not exists station_groups_name_key
  on public.station_groups (name);

comment on column public.station_groups.owner_id is
  'The admin who created the group. Groups are platform-wide, so this is provenance, not scope.';

-- 2. The link itself. ON DELETE SET NULL is what replaces the handler that used to unset the
--    text column by name.
alter table public.organizations
  add column if not exists station_group_id uuid
  references public.station_groups(id) on delete set null;

create index if not exists organizations_station_group_id_idx
  on public.organizations (station_group_id);

-- 3. Backfill from whatever names were already assigned. Anything whose text does not match a
--    surviving group is left null, which is the honest result: that group did not exist.
--
--    Guarded on the column existing. Migrations here are applied by hand, and prod was found
--    to be missing 026 and 027 entirely, so this cannot assume the text column is there. With
--    no column there is also nothing to backfill, and skipping is correct rather than a
--    fallback.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'station_group'
  ) then
    update public.organizations o
    set station_group_id = g.id
    from public.station_groups g
    where o.station_group_id is null
      and o.station_group is not null
      and o.station_group = g.name;
  end if;
end $$;

-- 4. RLS. Every application read and write goes through the service role and bypasses this
--    entirely; the policy is the backstop for anything arriving with a user's own token. The
--    old policy scoped rows to owner_id = auth.uid(), which no longer describes the table.
drop policy if exists "Users can manage their own groups" on public.station_groups;

create policy "Admins manage station groups"
  on public.station_groups
  for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

commit;
