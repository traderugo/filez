-- Point subscription_items.service_id at the services catalogue it actually holds.
--
-- 017 created the column as `references public.org_services(id)`, and nothing since corrected
-- it. org_services is a per-org list (org_id, name, description, sort_order) and has no
-- relationship to public.services, the platform catalogue every code path actually reads:
--
--   app/api/subscriptions/route.js         items built from the services list
--   app/api/admin/grant-subscription       .from('services')
--   lib/entryHelpers.js                    matches subscription_items.service_id to services.id
--
-- So on a database built from this folder, subscribing inserts a services.id into a column
-- constrained to org_services and fails with a foreign-key violation. Production evidently had
-- the constraint repointed by hand and it was never written down, so the drift only surfaced
-- when the schema was rebuilt from the migrations.
--
-- The constraint is looked up rather than named, because a by-hand fix may have left a name
-- other than the Postgres default.

do $$
declare
  conname_found text;
begin
  select con.conname into conname_found
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'subscription_items'
    and con.contype = 'f'
    and con.conkey = array[
      (select attnum from pg_attribute where attrelid = rel.oid and attname = 'service_id')
    ];

  if conname_found is not null then
    execute format('alter table public.subscription_items drop constraint %I', conname_found);
  end if;
end $$;

alter table public.subscription_items
  add constraint subscription_items_service_id_fkey
  foreign key (service_id) references public.services(id) on delete cascade;
