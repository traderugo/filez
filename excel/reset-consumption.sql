-- =============================================================================
-- Reset consumption entries: DELETE all then RE-INSERT clean data
-- Station: RAINOIL LUCKY WAY (467559c8-c0ad-48ca-b3f7-9fc2a35f7f92)
-- =============================================================================
-- Deletes all consumption_entries for the org, looks up customer IDs for
-- "Manager Car" (S.M) and "Generator" (Gen), then inserts 16 days of
-- March 2026 consumption data.
-- =============================================================================
-- Run this in Supabase SQL Editor, then hit "Refresh data" on the station page.
-- =============================================================================

DO $$
DECLARE
  v_org   uuid := '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';
  v_owner uuid := 'd3cb0c7f-1236-445a-a245-aa64f32f3e81';
  c_sm    uuid;  -- "Manager Car" customer
  c_gen   uuid;  -- "Generator" customer
BEGIN

  -- Step 1: Delete ALL consumption_entries for this org
  DELETE FROM consumption_entries WHERE org_id = v_org;
  RAISE NOTICE 'Deleted all consumption_entries for org %', v_org;

  -- Step 2: Look up customer IDs by name
  SELECT id INTO c_sm  FROM station_customers WHERE org_id = v_org AND name = 'Manager Car';
  SELECT id INTO c_gen FROM station_customers WHERE org_id = v_org AND name = 'Generator';

  IF c_sm IS NULL THEN RAISE EXCEPTION 'Customer "Manager Car" not found for org %', v_org; END IF;
  IF c_gen IS NULL THEN RAISE EXCEPTION 'Customer "Generator" not found for org %', v_org; END IF;

  RAISE NOTICE 'Manager Car = %, Generator = %', c_sm, c_gen;

  -- Step 3: Insert consumption entries
  -- Columns: id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at

  -- DAY 1 — 2026-03-01 (S.M=50 PMS @ 850, Gen=32 AGO @ 990)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-01', c_sm,  50, 'PMS', false, 850,  NULL, v_owner, now(), now()),
    (gen_random_uuid(), v_org, '2026-03-01', c_gen, 32, 'AGO', false, 990,  NULL, v_owner, now(), now());

  -- DAY 2 — 2026-03-02 (Gen=32 AGO @ 990)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-02', c_gen, 32, 'AGO', false, 990,  NULL, v_owner, now(), now());

  -- DAY 3 — 2026-03-03 (Gen=33 AGO @ 1050)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-03', c_gen, 33, 'AGO', false, 1050, NULL, v_owner, now(), now());

  -- DAY 4 — 2026-03-04 (Gen=32 AGO @ 1050)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-04', c_gen, 32, 'AGO', false, 1050, NULL, v_owner, now(), now());

  -- DAY 5 — 2026-03-05 (Gen=27 AGO @ 1050, Gen=5 AGO @ 1180)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-05', c_gen, 27, 'AGO', false, 1050, NULL, v_owner, now(), now()),
    (gen_random_uuid(), v_org, '2026-03-05', c_gen,  5, 'AGO', false, 1180, NULL, v_owner, now(), now());

  -- DAY 6 — 2026-03-06 (Gen=25 AGO @ 1200, Gen=7 AGO @ 1450)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-06', c_gen, 25, 'AGO', false, 1200, NULL, v_owner, now(), now()),
    (gen_random_uuid(), v_org, '2026-03-06', c_gen,  7, 'AGO', false, 1450, NULL, v_owner, now(), now());

  -- DAY 7 — 2026-03-07 (Gen=40 AGO @ 1450)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-07', c_gen, 40, 'AGO', false, 1450, NULL, v_owner, now(), now());

  -- DAY 8 — 2026-03-08 (Gen=32 AGO @ 1450)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-08', c_gen, 32, 'AGO', false, 1450, NULL, v_owner, now(), now());

  -- DAY 9 — 2026-03-09 (Gen=13 AGO @ 1465, Gen=19 AGO @ 1770)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-09', c_gen, 13, 'AGO', false, 1465, NULL, v_owner, now(), now()),
    (gen_random_uuid(), v_org, '2026-03-09', c_gen, 19, 'AGO', false, 1770, NULL, v_owner, now(), now());

  -- DAY 10 — 2026-03-10 (Gen=42 AGO @ 1770, S.M=50 PMS @ 1300)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-10', c_gen, 42, 'AGO', false, 1770, NULL, v_owner, now(), now()),
    (gen_random_uuid(), v_org, '2026-03-10', c_sm,  50, 'PMS', false, 1300, NULL, v_owner, now(), now());

  -- DAY 11 — 2026-03-11 (Gen=32 AGO @ 1770)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-11', c_gen, 32, 'AGO', false, 1770, NULL, v_owner, now(), now());

  -- DAY 12 — 2026-03-12 (Gen=32 AGO @ 1770)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-12', c_gen, 32, 'AGO', false, 1770, NULL, v_owner, now(), now());

  -- DAY 13 — 2026-03-13 (Gen=32 AGO @ 1700)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-13', c_gen, 32, 'AGO', false, 1700, NULL, v_owner, now(), now());

  -- DAY 14 — 2026-03-14 (Gen=32 AGO @ 1700)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-14', c_gen, 32, 'AGO', false, 1700, NULL, v_owner, now(), now());

  -- DAY 15 — 2026-03-15 (Gen=32 AGO @ 1700)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-15', c_gen, 32, 'AGO', false, 1700, NULL, v_owner, now(), now());

  -- DAY 16 — 2026-03-16 (S.M=50 PMS @ 1300, Gen=32 AGO @ 1670)
  INSERT INTO consumption_entries (id, org_id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes, created_by, created_at, updated_at) VALUES
    (gen_random_uuid(), v_org, '2026-03-16', c_sm,  50, 'PMS', false, 1300, NULL, v_owner, now(), now()),
    (gen_random_uuid(), v_org, '2026-03-16', c_gen, 32, 'AGO', false, 1670, NULL, v_owner, now(), now());

  RAISE NOTICE 'Done — inserted 22 consumption entries across 16 days (Mar 1-16)';
END $$;
