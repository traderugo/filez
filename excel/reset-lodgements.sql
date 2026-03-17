-- =============================================================================
-- Reset + Re-insert ALL lodgement data for March 2026 (Days 1-16)
-- Station: RAINOIL LUCKY WAY (467559c8-c0ad-48ca-b3f7-9fc2a35f7f92)
-- =============================================================================
-- Run this in Supabase SQL Editor.
-- =============================================================================

-- Step 1: Delete all existing lodgement entries
DELETE FROM lodgement_entries WHERE org_id = '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';

-- Step 2: Re-insert lodgement data
DO $$
DECLARE
  v_org   uuid := '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';
  v_owner uuid := 'd3cb0c7f-1236-445a-a245-aa64f32f3e81';
  -- Banks (POS)
  b_stanbic1 uuid := '884ffcb0-3d05-4b0f-b4b3-f375460cfcb3';
  b_stanbic2 uuid := 'f2159824-1854-423d-be05-9d83dfd81558';
  b_stanbic3 uuid := '94611f13-7ab6-45f0-a32d-ab34e1a36e25';
  b_globus   uuid := '684b98b5-ee46-4bc0-af15-3fc0de122970';
  -- Banks (Transfer)
  b_stan3tf  uuid := 'ecc2df45-78c6-4d76-bce9-828bdeb31629';
  b_fcmb     uuid := 'e28538df-4daf-4c9f-9c7b-cbb6888a2b18';
  -- Banks (Bank Deposit)
  b_keystone uuid := '9838a173-e79e-4b0d-bad6-d65a7b40171e';
BEGIN

  -- Day 1 -- 2026-03-01
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-01', 1091855, b_stanbic1, 'pos', '2026-03-01', v_owner),
    (v_org, '2026-03-01', 1545361, b_stanbic2, 'pos', '2026-03-01', v_owner),
    (v_org, '2026-03-01', 909300, b_stanbic3, 'pos', '2026-03-01', v_owner),
    (v_org, '2026-03-01', 588105, b_keystone, 'deposit', '2026-03-01', v_owner);

  -- Day 2 -- 2026-03-02
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-02', 1344855, b_stanbic1, 'pos', '2026-03-02', v_owner),
    (v_org, '2026-03-02', 1529910, b_stanbic2, 'pos', '2026-03-02', v_owner),
    (v_org, '2026-03-02', 1415940, b_stanbic3, 'pos', '2026-03-02', v_owner),
    (v_org, '2026-03-02', 152800, b_keystone, 'deposit', '2026-03-02', v_owner);

  -- Day 3 -- 2026-03-03
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-03', 1182858, b_stanbic1, 'pos', '2026-03-03', v_owner),
    (v_org, '2026-03-03', 1626441, b_stanbic2, 'pos', '2026-03-03', v_owner),
    (v_org, '2026-03-03', 1214600, b_stanbic3, 'pos', '2026-03-03', v_owner),
    (v_org, '2026-03-03', 188600, b_keystone, 'deposit', '2026-03-03', v_owner);

  -- Day 4 -- 2026-03-04
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-04', 2137691, b_stanbic1, 'pos', '2026-03-04', v_owner),
    (v_org, '2026-03-04', 1248838, b_stanbic2, 'pos', '2026-03-04', v_owner),
    (v_org, '2026-03-04', 1293287, b_stanbic3, 'pos', '2026-03-04', v_owner),
    (v_org, '2026-03-04', 199100, b_keystone, 'deposit', '2026-03-04', v_owner);

  -- Day 5 -- 2026-03-05
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-05', 831197, b_stanbic1, 'pos', '2026-03-05', v_owner),
    (v_org, '2026-03-05', 1117574, b_stanbic2, 'pos', '2026-03-05', v_owner),
    (v_org, '2026-03-05', 1717020, b_stanbic3, 'pos', '2026-03-05', v_owner),
    (v_org, '2026-03-05', 1029080, b_keystone, 'deposit', '2026-03-05', v_owner);

  -- Day 6 -- 2026-03-06
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-06', 2010654, b_stanbic1, 'pos', '2026-03-06', v_owner),
    (v_org, '2026-03-06', 1519664, b_stanbic2, 'pos', '2026-03-06', v_owner),
    (v_org, '2026-03-06', 1700622, b_stanbic3, 'pos', '2026-03-06', v_owner),
    (v_org, '2026-03-06', 986585, b_keystone, 'deposit', '2026-03-06', v_owner);

  -- Day 7 -- 2026-03-07
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-07', 2526460, b_stanbic1, 'pos', '2026-03-07', v_owner),
    (v_org, '2026-03-07', 1703798, b_stanbic2, 'pos', '2026-03-07', v_owner),
    (v_org, '2026-03-07', 749800, b_stanbic3, 'pos', '2026-03-07', v_owner),
    (v_org, '2026-03-07', 642000, b_keystone, 'deposit', '2026-03-07', v_owner);

  -- Day 8 -- 2026-03-08
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-08', 2171982, b_stanbic1, 'pos', '2026-03-08', v_owner),
    (v_org, '2026-03-08', 1876291, b_stanbic2, 'pos', '2026-03-08', v_owner),
    (v_org, '2026-03-08', 230360, b_keystone, 'deposit', '2026-03-08', v_owner);

  -- Day 9 -- 2026-03-09
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-09', 1456311, b_stanbic1, 'pos', '2026-03-09', v_owner),
    (v_org, '2026-03-09', 2388865, b_stanbic2, 'pos', '2026-03-09', v_owner),
    (v_org, '2026-03-09', 526075, b_keystone, 'deposit', '2026-03-09', v_owner);

  -- Day 10 -- 2026-03-10
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-10', 3569487, b_stanbic1, 'pos', '2026-03-10', v_owner),
    (v_org, '2026-03-10', 2142360, b_stanbic2, 'pos', '2026-03-10', v_owner),
    (v_org, '2026-03-10', 218730, b_keystone, 'deposit', '2026-03-10', v_owner);

  -- Day 11 -- 2026-03-11
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-11', 2168584, b_stanbic1, 'pos', '2026-03-11', v_owner),
    (v_org, '2026-03-11', 3300520, b_stanbic2, 'pos', '2026-03-11', v_owner),
    (v_org, '2026-03-11', 618230, b_keystone, 'deposit', '2026-03-11', v_owner);

  -- Day 12 -- 2026-03-12
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-12', 1135560, b_stanbic1, 'pos', '2026-03-12', v_owner),
    (v_org, '2026-03-12', 4122110, b_stanbic2, 'pos', '2026-03-12', v_owner),
    (v_org, '2026-03-12', 574200, b_keystone, 'deposit', '2026-03-12', v_owner);

  -- Day 13 -- 2026-03-13
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-13', 3053078, b_stanbic1, 'pos', '2026-03-13', v_owner),
    (v_org, '2026-03-13', 1567614, b_stanbic2, 'pos', '2026-03-13', v_owner),
    (v_org, '2026-03-13', 435000, b_keystone, 'deposit', '2026-03-13', v_owner);

  -- Day 14 -- 2026-03-14
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-14', 2003430, b_stanbic1, 'pos', '2026-03-14', v_owner),
    (v_org, '2026-03-14', 2263328, b_stanbic2, 'pos', '2026-03-14', v_owner),
    (v_org, '2026-03-14', 1378350, b_keystone, 'deposit', '2026-03-14', v_owner);

  -- Day 15 -- 2026-03-15
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-15', 2711327, b_stanbic1, 'pos', '2026-03-15', v_owner),
    (v_org, '2026-03-15', 1716700, b_stanbic2, 'pos', '2026-03-15', v_owner),
    (v_org, '2026-03-15', 377875, b_keystone, 'deposit', '2026-03-15', v_owner);

  -- Day 16 -- 2026-03-16
  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-16', 1809876, b_stanbic1, 'pos', '2026-03-16', v_owner),
    (v_org, '2026-03-16', 3723763, b_stanbic2, 'pos', '2026-03-16', v_owner);

  RAISE NOTICE 'Done -- inserted lodgement entries for days 1-16';
END $$;
