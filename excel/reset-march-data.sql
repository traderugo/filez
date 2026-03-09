-- =============================================================================
-- Reset March data: DELETE duplicates then RE-INSERT clean data
-- Station: RAINOIL LUCKY WAY (467559c8-c0ad-48ca-b3f7-9fc2a35f7f92)
-- =============================================================================
-- Run this in Supabase SQL Editor, then hit "Refresh data" on the station page.
-- =============================================================================

DO $$
DECLARE
  v_org uuid := '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';
BEGIN
  -- Step 1: Delete ALL daily_sales_entries for this org
  DELETE FROM daily_sales_entries WHERE org_id = v_org;
  RAISE NOTICE 'Deleted all daily_sales_entries for org %', v_org;

  -- Step 2: Delete ALL lodgement_entries for this org
  DELETE FROM lodgement_entries WHERE org_id = v_org;
  RAISE NOTICE 'Deleted all lodgement_entries for org %', v_org;
END $$;

-- Step 3: Re-insert clean data from the original script
-- (copy of insert-march-data.sql)

DO $$
DECLARE
  v_org   uuid := '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';
  v_owner uuid := 'd3cb0c7f-1236-445a-a245-aa64f32f3e81';
  -- Pumps
  pms1 uuid := '1c4b5fbe-dd5e-4bae-a0a7-8347bd179d8f';
  pms2 uuid := '02be5b9c-f2e0-4931-a6b5-d42b280b4b58';
  pms3 uuid := 'af8985c5-3de6-4470-a35b-2e64ab398b49';
  pms4 uuid := '55aa8d87-a9c8-4653-9fcb-f089485b4b69';
  pms5 uuid := 'c6a832b2-6e6e-4088-91c0-14025436d538';
  pms6 uuid := '172fe524-809a-494a-892f-1476236f8714';
  pms7 uuid := '1e55b987-4008-4cb2-8e60-1af75cfe256d';
  pms8 uuid := '51ca2912-4270-4c38-95e6-05b088aa2a0e';
  ago1 uuid := 'c704f897-2c47-4aa9-b4af-982b8a585692';
  ago2 uuid := 'fae99d82-0fc0-4943-8fa6-4aa86a775491';
  dpk1 uuid := 'c063d2a9-d7cc-477f-99b5-d5a76ec974ed';
  dpk2 uuid := 'ae0101e8-b505-4511-b120-27b08174410f';
  -- Tanks
  t_pms1 uuid := '1a4e2e18-a9c7-4a98-9489-85d0f6de559d';
  t_pms2 uuid := '3cddf0a9-67ac-4d03-9df9-f883ae13aba9';
  t_ago  uuid := 'e0912efc-2d2e-4fde-811a-3b21c7e03d9d';
  t_dpk  uuid := 'fa6acbd7-ba89-4d8e-866e-3f156104741f';
  -- Banks
  b_stanbic1 uuid := '884ffcb0-3d05-4b0f-b4b3-f375460cfcb3';
  b_stanbic2 uuid := 'f2159824-1854-423d-be05-9d83dfd81558';
  b_stanbic3 uuid := '94611f13-7ab6-45f0-a32d-ab34e1a36e25';
BEGIN

  -- DAY 1 — 2026-03-01 (PMS ₦850, AGO ₦990)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-01',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 945281, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913278, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1363469,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1149584,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1214846,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1040351,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012522,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1146741,'consumption', 50, 'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 305900, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 255784, 'consumption', 32, 'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 27700),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 11500),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 25000),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    65300,
    '{"PMS": 850, "AGO": 990, "DPK": 0}'::jsonb,
    'Consumption: S.M=50, Gen=32',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-01', 1091855, b_stanbic1, 'pos', '2026-03-01', v_owner),
    (v_org, '2026-03-01', 1545361, b_stanbic2, 'pos', '2026-03-01', v_owner),
    (v_org, '2026-03-01', 909300,  b_stanbic3, 'pos', '2026-03-01', v_owner);

  -- DAY 2 — 2026-03-02 (PMS ₦850, AGO ₦990)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-02',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 945281, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913278, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1365264,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1149584,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1214846,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1041765,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012522,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1148310,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 306025, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 256077, 'consumption', 32, 'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 24300),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 10000),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 24500),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    59900,
    '{"PMS": 850, "AGO": 990, "DPK": 0}'::jsonb,
    'Consumption: S.M=0, Gen=32',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-02', 1344855, b_stanbic1, 'pos', '2026-03-02', v_owner),
    (v_org, '2026-03-02', 1529910, b_stanbic2, 'pos', '2026-03-02', v_owner),
    (v_org, '2026-03-02', 1415940, b_stanbic3, 'pos', '2026-03-02', v_owner);

  -- DAY 3 — 2026-03-03 (PMS ₦850, AGO ₦990)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-03',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 945479, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913278, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1365359,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1149584,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1214846,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1041765,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012522,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1148333,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 306057, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 256080, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 21400),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 8800),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 24300),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    55600,
    '{"PMS": 850, "AGO": 990, "DPK": 0}'::jsonb,
    'Consumption: S.M=0, Gen=33',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-03', 1182858, b_stanbic1, 'pos', '2026-03-03', v_owner),
    (v_org, '2026-03-03', 1626441, b_stanbic2, 'pos', '2026-03-03', v_owner),
    (v_org, '2026-03-03', 1214600, b_stanbic3, 'pos', '2026-03-03', v_owner);

  -- DAY 4 — 2026-03-04 (PMS ₦950, AGO ₦1050)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-04',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 946603, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913278, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1368756,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1149584,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1214936,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1043423,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012522,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1150835,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 306286, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 256350, 'consumption', 32, 'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 18450),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 7000),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 24000),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    50550,
    '{"PMS": 950, "AGO": 1050, "DPK": 0}'::jsonb,
    'Consumption: S.M=0, Gen=32',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-04', 2137691, b_stanbic1, 'pos', '2026-03-04', v_owner),
    (v_org, '2026-03-04', 1248838, b_stanbic2, 'pos', '2026-03-04', v_owner),
    (v_org, '2026-03-04', 1293287, b_stanbic3, 'pos', '2026-03-04', v_owner);

  -- DAY 5 — 2026-03-05 (PMS ₦950, AGO ₦1050)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-05',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 946603, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913278, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1369581,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1150751,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1215271,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1044332,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012522,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1152106,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 306286, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 256575, 'consumption', 27, 'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 15300),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 5750),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 23700),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    45850,
    '{"PMS": 950, "AGO": 1050, "DPK": 0}'::jsonb,
    'Consumption: S.M=0, Gen=27',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-05', 831197,  b_stanbic1, 'pos', '2026-03-05', v_owner),
    (v_org, '2026-03-05', 1117574, b_stanbic2, 'pos', '2026-03-05', v_owner),
    (v_org, '2026-03-05', 1717020, b_stanbic3, 'pos', '2026-03-05', v_owner);

  -- DAY 6 — 2026-03-06 (PMS ₦950, AGO ₦1200)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-06',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 947628, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913374, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1370607,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1151178,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1215271,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1044332,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012522,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1153635,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 306333, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 256900, 'consumption', 25, 'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 10800),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 4450),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 23100),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    39450,
    '{"PMS": 950, "AGO": 1200, "DPK": 0}'::jsonb,
    'Consumption: S.M=0, Gen=32',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-06', 2010654, b_stanbic1, 'pos', '2026-03-06', v_owner),
    (v_org, '2026-03-06', 1519664, b_stanbic2, 'pos', '2026-03-06', v_owner),
    (v_org, '2026-03-06', 1700622, b_stanbic3, 'pos', '2026-03-06', v_owner);

  -- DAY 7 — 2026-03-07 (PMS ₦1050, AGO ₦1450)
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '2026-03-07',
    jsonb_build_array(
      jsonb_build_object('pump_id', pms1, 'nozzle_label', 'PMS 1', 'closing_meter', 948707, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms2, 'nozzle_label', 'PMS 2', 'closing_meter', 913374, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms3, 'nozzle_label', 'PMS 3', 'closing_meter', 1372215,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms4, 'nozzle_label', 'PMS 4', 'closing_meter', 1151178,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms5, 'nozzle_label', 'PMS 5', 'closing_meter', 1215271,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms6, 'nozzle_label', 'PMS 6', 'closing_meter', 1044332,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms7, 'nozzle_label', 'PMS 7', 'closing_meter', 1012523,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', pms8, 'nozzle_label', 'PMS 8', 'closing_meter', 1155521,'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago1, 'nozzle_label', 'AGO 1', 'closing_meter', 306754, 'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', ago2, 'nozzle_label', 'AGO 2', 'closing_meter', 257358, 'consumption', 40, 'pour_back', 0),
      jsonb_build_object('pump_id', dpk1, 'nozzle_label', 'DPK 1', 'closing_meter', 70080,  'consumption', 0,  'pour_back', 0),
      jsonb_build_object('pump_id', dpk2, 'nozzle_label', 'DPK 2', 'closing_meter', 98301,  'consumption', 0,  'pour_back', 0)
    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', 7900),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', 2800),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', 22600),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', 1100)
    ),
    34400,
    '{"PMS": 1050, "AGO": 1450, "DPK": 0}'::jsonb,
    'Consumption: S.M=0, Gen=40',
    v_owner
  );

  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
    (v_org, '2026-03-07', 2526460, b_stanbic1, 'pos', '2026-03-07', v_owner),
    (v_org, '2026-03-07', 1703798, b_stanbic2, 'pos', '2026-03-07', v_owner),
    (v_org, '2026-03-07', 749800,  b_stanbic3, 'pos', '2026-03-07', v_owner);

  RAISE NOTICE 'Done — deleted duplicates and re-inserted 7 daily sales + 21 POS lodgements';
END $$;
