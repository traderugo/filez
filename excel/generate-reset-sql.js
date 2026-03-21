const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('excel/DAILY SALES OPERATION MARCH 2026 (1).xlsx');

// LODGEMENT sheet — col M ("Actual") = Keystone bank_deposit per day
const lodgementSheet = wb.Sheets['LODGEMENT'];
const lodgementVal = (addr) => { const c = lodgementSheet[addr]; return c && c.v !== undefined ? c.v : null; };
const keystoneByDay = {};
for (let day = 1; day <= 31; day++) {
  const row = 5 + (day - 1) * 3;
  keystoneByDay[day] = lodgementVal('M' + row) || 0;
}

const pumpVars = ['pms1','pms2','pms3','pms4','pms5','pms6','pms7','pms8','ago1','ago2','dpk1','dpk2'];
const pumpLabels = ['PMS 1','PMS 2','PMS 3','PMS 4','PMS 5','PMS 6','PMS 7','PMS 8','AGO 1','AGO 2','DPK 1','DPK 2'];
const pumpRows = { PMS: [3,4,5,6,7,8,9,10], AGO: [12,13], DPK: [15,16] };

let sql = `-- =============================================================================
-- Reset + Re-insert ALL March data (Days 1-16) with updated bank mappings
-- Station: RAINOIL LUCKY WAY (467559c8-c0ad-48ca-b3f7-9fc2a35f7f92)
-- =============================================================================
-- Run this in Supabase SQL Editor. It deletes ALL existing data and re-inserts.
-- =============================================================================

-- Step 1: Delete all existing data
DELETE FROM lodgement_entries WHERE org_id = '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';
DELETE FROM daily_sales_entries WHERE org_id = '467559c8-c0ad-48ca-b3f7-9fc2a35f7f92';

-- Step 2: Re-insert clean data
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
`;

for (let day = 1; day <= 16; day++) {
  const ws = wb.Sheets[String(day)];
  if (!ws) continue;
  const val = (addr) => { const c = ws[addr]; return c && c.v !== undefined ? c.v : null; };

  const date = '2026-03-' + String(day).padStart(2, '0');
  const pmsPrice = val('G11') || 0;
  const agoPrice = val('G14') || 0;

  // Nozzle readings
  const allPumps = [];
  let pumpIdx = 0;
  for (const fuel of ['PMS','AGO','DPK']) {
    for (const r of pumpRows[fuel]) {
      const closing = val('C'+r) || 0;
      const consumption = val('E'+r) || 0;
      allPumps.push({ var: pumpVars[pumpIdx], label: pumpLabels[pumpIdx], closing, consumption });
      pumpIdx++;
    }
  }

  // Tank readings
  const tPms1 = val('M3') || 0;
  const tPms2 = val('M4') || 0;
  const tAgo = val('M6') || 0;
  const tDpk = val('M7') || 0;
  const ugt = Math.round(tPms1 + tPms2 + tAgo + tDpk);

  // Consumption
  const sm = val('L11') || 0;
  const gen = val('L12') || 0;
  const logistics = val('L13') || 0;
  const rm = val('L14') || 0;
  const am = val('L15') || 0;
  const others = val('L16') || 0;
  const consParts = [];
  if (sm) consParts.push('S.M=' + sm);
  if (gen) consParts.push('Gen=' + gen);
  if (logistics) consParts.push('Logistics=' + logistics);
  if (rm) consParts.push('R.M=' + rm);
  if (am) consParts.push('A.M=' + am);
  if (others) consParts.push('Others=' + others);
  const notes = consParts.length ? 'Consumption: ' + consParts.join(', ') : '';

  // POS / Transfer values
  const stanbic1 = val('J11') || 0;
  const stanbic2 = val('J12') || 0;
  const stanbic3 = val('J13') || 0;
  const stan3tf = val('J14') || 0;
  const globus = val('J15') || 0;
  const fcmb = val('J16') || 0;

  sql += `
  -- ========================================================================
  -- DAY ${day} -- ${date}  (PMS N${pmsPrice}, AGO N${agoPrice})
  -- ========================================================================
  INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
  VALUES (
    v_org, '${date}',
    jsonb_build_array(
`;

  for (let i = 0; i < allPumps.length; i++) {
    const p = allPumps[i];
    const comma = i < allPumps.length - 1 ? ',' : '';
    sql += `      jsonb_build_object('pump_id', ${p.var}, 'nozzle_label', '${p.label}', 'closing_meter', ${p.closing}, 'consumption', ${p.consumption}, 'pour_back', 0)${comma}\n`;
  }

  sql += `    ),
    jsonb_build_array(
      jsonb_build_object('tank_id', t_pms1, 'tank_label', 'PMS Tank 1', 'closing_stock', ${tPms1}),
      jsonb_build_object('tank_id', t_pms2, 'tank_label', 'PMS Tank 2', 'closing_stock', ${tPms2}),
      jsonb_build_object('tank_id', t_ago,  'tank_label', 'AGO Tank',   'closing_stock', ${tAgo}),
      jsonb_build_object('tank_id', t_dpk,  'tank_label', 'DPK Tank',   'closing_stock', ${tDpk})
    ),
    ${ugt},
    '{"PMS": ${pmsPrice}, "AGO": ${agoPrice}, "DPK": 0}'::jsonb,
    '${notes}',
    v_owner
  );
`;

  // Lodgement entries (only insert non-zero values)
  const lodgements = [];
  if (stanbic1 > 0) lodgements.push({ amount: stanbic1, bank: 'b_stanbic1', type: 'pos' });
  if (stanbic2 > 0) lodgements.push({ amount: stanbic2, bank: 'b_stanbic2', type: 'pos' });
  if (stanbic3 > 0) lodgements.push({ amount: stanbic3, bank: 'b_stanbic3', type: 'pos' });
  if (stan3tf > 0)  lodgements.push({ amount: stan3tf,  bank: 'b_stan3tf',  type: 'transfer' });
  if (globus > 0)   lodgements.push({ amount: globus,   bank: 'b_globus',   type: 'pos' });
  if (fcmb > 0)     lodgements.push({ amount: fcmb,     bank: 'b_fcmb',     type: 'transfer' });
  const keystone = keystoneByDay[day] || 0;
  if (keystone > 0) lodgements.push({ amount: keystone, bank: 'b_keystone', type: 'deposit' });

  if (lodgements.length > 0) {
    sql += `\n  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES\n`;
    for (let i = 0; i < lodgements.length; i++) {
      const l = lodgements[i];
      const comma = i < lodgements.length - 1 ? ',' : ';';
      sql += `    (v_org, '${date}', ${l.amount}, ${l.bank}, '${l.type}', '${date}', v_owner)${comma}\n`;
    }
  }
}

sql += `
  RAISE NOTICE 'Done -- inserted 16 daily sales entries + lodgement entries for RAINOIL LUCKY WAY';
END $$;
`;

fs.writeFileSync('excel/reset-march-data.sql', sql);
console.log('Written to excel/reset-march-data.sql');
console.log('Lines:', sql.split('\n').length);
