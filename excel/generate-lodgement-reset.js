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

let sql = `-- =============================================================================
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
`;

for (let day = 1; day <= 16; day++) {
  const ws = wb.Sheets[String(day)];
  if (!ws) continue;
  const val = (addr) => { const c = ws[addr]; return c && c.v !== undefined ? c.v : null; };

  const date = '2026-03-' + String(day).padStart(2, '0');

  // POS / Transfer values from daily sheet
  const stanbic1 = val('J11') || 0;
  const stanbic2 = val('J12') || 0;
  const stanbic3 = val('J13') || 0;
  const stan3tf = val('J14') || 0;
  const globus = val('J15') || 0;
  const fcmb = val('J16') || 0;

  // Keystone bank_deposit from LODGEMENT sheet
  const keystone = keystoneByDay[day] || 0;

  const lodgements = [];
  if (stanbic1 > 0) lodgements.push({ amount: stanbic1, bank: 'b_stanbic1', type: 'pos' });
  if (stanbic2 > 0) lodgements.push({ amount: stanbic2, bank: 'b_stanbic2', type: 'pos' });
  if (stanbic3 > 0) lodgements.push({ amount: stanbic3, bank: 'b_stanbic3', type: 'pos' });
  if (stan3tf > 0)  lodgements.push({ amount: stan3tf,  bank: 'b_stan3tf',  type: 'transfer' });
  if (globus > 0)   lodgements.push({ amount: globus,   bank: 'b_globus',   type: 'pos' });
  if (fcmb > 0)     lodgements.push({ amount: fcmb,     bank: 'b_fcmb',     type: 'transfer' });
  if (keystone > 0) lodgements.push({ amount: keystone, bank: 'b_keystone', type: 'deposit' });

  if (lodgements.length === 0) continue;

  sql += `\n  -- Day ${day} -- ${date}\n`;
  sql += `  INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES\n`;
  for (let i = 0; i < lodgements.length; i++) {
    const l = lodgements[i];
    const comma = i < lodgements.length - 1 ? ',' : ';';
    sql += `    (v_org, '${date}', ${l.amount}, ${l.bank}, '${l.type}', '${date}', v_owner)${comma}\n`;
  }
}

sql += `
  RAISE NOTICE 'Done -- inserted lodgement entries for days 1-16';
END $$;
`;

fs.writeFileSync('excel/reset-lodgements.sql', sql);
console.log('Written to excel/reset-lodgements.sql');
console.log('Lines:', sql.split('\n').length);
