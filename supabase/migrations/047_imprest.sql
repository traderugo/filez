-- 047: Imprest (Petty Cash) tables
-- Monthly imprest periods + individual expense entries with receipt images

-- ── imprest_periods ─────────────────────────────────────────────────────────
create table if not exists imprest_periods (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  month         smallint not null check (month between 1 and 12),
  year          smallint not null check (year between 2020 and 2099),
  imprest_amount numeric(12,2) not null default 0,
  custodian_name text,
  form_number   text,
  notes         text,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, month, year)
);

create index idx_imprest_periods_org on imprest_periods(org_id);

alter table imprest_periods enable row level security;

create policy "Users can view their org imprest periods"
  on imprest_periods for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Users can insert imprest periods for their org"
  on imprest_periods for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

create policy "Users can update their org imprest periods"
  on imprest_periods for update
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Admin full access imprest periods"
  on imprest_periods for all
  using (org_id = admin_org_id());

-- ── imprest_entries ─────────────────────────────────────────────────────────
create table if not exists imprest_entries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  imprest_period_id uuid not null references imprest_periods(id) on delete cascade,
  entry_date        date not null,
  beneficiary       text not null,
  transaction_details text,
  amount            numeric(12,2) not null default 0,
  account_code      text,
  pcv_number        text,
  receipt_image_url text,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index idx_imprest_entries_org on imprest_entries(org_id);
create index idx_imprest_entries_period on imprest_entries(imprest_period_id);
create index idx_imprest_entries_date on imprest_entries(entry_date);

alter table imprest_entries enable row level security;

create policy "Users can view their org imprest entries"
  on imprest_entries for select
  using (org_id in (select org_id from users where id = auth.uid()));

create policy "Users can insert imprest entries for their org"
  on imprest_entries for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

create policy "Users can update their own imprest entries"
  on imprest_entries for update
  using (created_by = auth.uid());

create policy "Users can delete their own imprest entries"
  on imprest_entries for delete
  using (created_by = auth.uid());

create policy "Admin full access imprest entries"
  on imprest_entries for all
  using (org_id = admin_org_id());
