# Extracting Daily Sales from Excel → Database

Step-by-step process to extract data from a DSO (Daily Sales Operation) Excel file and insert it into the station-portal database.

---

## Prerequisites

- Node.js installed
- `xlsx` npm package (`npm install xlsx --no-save`)
- Access to Supabase SQL Editor
- The station must already be created with pumps, tanks, and banks configured

---

## Step 1: Inspect the Excel file

Place the Excel file in the `excel/` folder. Run a quick inspection to understand the sheet layout:

```js
node -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile('excel/YOUR_FILE.xlsx');
console.log('Sheets:', wb.SheetNames);
// Inspect Day 1 cell layout
const ws = wb.Sheets['1'];
for (let r = 1; r <= 20; r++) {
  let row = 'Row ' + r + ': ';
  for (const c of ['A','B','C','D','E','F','G','H','I','J','K','L','M','N']) {
    const cell = ws[c+r];
    if (cell && cell.v !== undefined) row += c + '=' + JSON.stringify(cell.v) + '  ';
  }
  console.log(row);
}
"
```

**Expected layout per daily sheet (e.g. sheet "1" = Day 1):**

| Data | Column | Rows |
|------|--------|------|
| PMS pump labels | A | 3–10 (row 3 = "PMS 1", rows 4–10 = just the number) |
| AGO pump labels | A | 12–13 |
| DPK pump labels | A | 15–16 |
| Closing metre readings | C | Same rows as above |
| Per-pump consumption | E | Same rows (most are 0) |
| PMS price | G | Row 11 |
| AGO price | G | Row 14 |
| Tank closing stock labels | I | Rows 3–7 (PMS 1, PMS 2, Total, AGO, DPK) |
| Tank closing stock values | M | Rows 3–7 |
| POS terminal labels | I | Rows 11–16 |
| POS terminal values | J | Rows 11–16 |
| Consumption labels | K | Rows 11–16 (S.M, Gen, Logistics, R.M, A.M, Others) |
| Consumption values | L | Rows 11–16 |

> If your Excel has a different layout, adjust the row/column references accordingly.

---

## Step 2: Extract data to markdown

Run the extraction script. Adjust the day range and file path:

```js
node -e "
const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('excel/YOUR_FILE.xlsx');
let md = '# Daily Sales Operation — March 2026 (Days 1–7)\n\n';

for (let day = 1; day <= 7; day++) {
  const ws = wb.Sheets[String(day)];
  if (!ws) { md += '## Day ' + day + '\nSheet not found.\n\n'; continue; }
  const val = (addr) => { const c = ws[addr]; if (!c) return null; return c.v !== undefined ? c.v : null; };
  const fmt = (v) => v !== null && v !== '' ? String(v) : '-';

  md += '## Day ' + day + '\n\n';

  // Closing Metre Readings
  md += '### Closing Metre Readings\n\n| Pump | Reading |\n|------|--------|\n';
  for (let r = 3; r <= 10; r++) {
    const raw = val('A'+r); const reading = val('C'+r);
    if (raw === null && reading === null) continue;
    md += '| ' + (r === 3 ? String(raw) : 'PMS ' + raw) + ' | ' + fmt(reading) + ' |\n';
  }
  for (let r = 12; r <= 13; r++) {
    const raw = val('A'+r); const reading = val('C'+r);
    if (raw === null && reading === null) continue;
    md += '| ' + (r === 12 ? String(raw) : 'AGO ' + raw) + ' | ' + fmt(reading) + ' |\n';
  }
  for (let r = 15; r <= 16; r++) {
    const raw = val('A'+r); const reading = val('C'+r);
    if (raw === null && reading === null) continue;
    md += '| ' + (r === 15 ? String(raw) : 'DPK ' + raw) + ' | ' + fmt(reading) + ' |\n';
  }

  // Closing Stock
  md += '\n### Closing Stock\n\n| Tank | Value |\n|------|-------|\n';
  for (let r = 3; r <= 7; r++) md += '| ' + fmt(val('I'+r)) + ' | ' + fmt(val('M'+r)) + ' |\n';

  // POS Values
  md += '\n### POS Values\n\n| Terminal | Amount |\n|----------|--------|\n';
  for (let r = 11; r <= 16; r++) {
    const label = val('I'+r);
    if (label !== null) md += '| ' + String(label).trim() + ' | ' + fmt(val('J'+r)) + ' |\n';
  }

  // Consumption
  md += '\n### Consumption\n\n| Item | Value |\n|------|-------|\n';
  for (let r = 11; r <= 16; r++) {
    const label = val('K'+r);
    if (label !== null) md += '| ' + label + ' | ' + fmt(val('L'+r)) + ' |\n';
  }

  // Prices
  md += '\n**Prices:** PMS=' + fmt(val('G11')) + ', AGO=' + fmt(val('G14')) + '\n';
  md += '\n---\n\n';
}

fs.writeFileSync('excel/extracted-data.md', md);
console.log('Saved to excel/extracted-data.md');
"
```

Review `excel/extracted-data.md` to verify data looks correct.

---

## Step 3: Get station details

Run this query in Supabase SQL Editor (replace the UUID):

**Station + owner:**
```sql
SELECT id, name, owner_id FROM organizations WHERE id = 'YOUR_ORG_UUID';
```

**Pumps:**
```sql
SELECT id, fuel_type, pump_number, initial_reading FROM station_pumps WHERE org_id = 'YOUR_ORG_UUID' ORDER BY fuel_type, pump_number;
```

**Tanks:**
```sql
SELECT id, fuel_type, tank_number, capacity FROM station_tanks WHERE org_id = 'YOUR_ORG_UUID' ORDER BY fuel_type, tank_number;
```

**Banks:**
```sql
SELECT id, bank_name, lodgement_type FROM station_banks WHERE org_id = 'YOUR_ORG_UUID' ORDER BY sort_order;
```

Save the output — you'll need all the UUIDs for the insert SQL.

---

## Step 4: Write the insert SQL

Use `excel/insert-march-data.sql` as a template. The structure per day is:

### Daily sales entry

```sql
INSERT INTO daily_sales_entries (org_id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, created_by)
VALUES (
  v_org, '2026-03-XX',
  jsonb_build_array(
    -- One object per pump:
    jsonb_build_object('pump_id', <pump_uuid>, 'nozzle_label', 'PMS 1', 'closing_meter', <value>, 'consumption', <value>, 'pour_back', 0)
    -- ... repeat for all pumps
  ),
  jsonb_build_array(
    -- One object per tank:
    jsonb_build_object('tank_id', <tank_uuid>, 'tank_label', 'PMS Tank 1', 'closing_stock', <value>)
    -- ... repeat for all tanks
  ),
  <ugt_total>,  -- sum of all tank closing_stock values
  '{"PMS": <price>, "AGO": <price>, "DPK": <price>}'::jsonb,
  'Consumption: S.M=<val>, Gen=<val>',
  v_owner
);
```

### POS lodgement entries

```sql
INSERT INTO lodgement_entries (org_id, entry_date, amount, bank_id, lodgement_type, sales_date, created_by) VALUES
  (v_org, '2026-03-XX', <amount>, <bank_uuid>, 'pos', '2026-03-XX', v_owner);
```

### Key mappings

| Excel field | Database field |
|-------------|---------------|
| Closing metre readings (col C) | `nozzle_readings[].closing_meter` |
| Per-pump consumption (col E) | `nozzle_readings[].consumption` |
| Tank closing stock (col M) | `tank_readings[].closing_stock` |
| PMS price (G11) | `prices.PMS` |
| AGO price (G14) | `prices.AGO` |
| POS values (col J) | `lodgement_entries.amount` |
| Consumption breakdown (col K+L) | `notes` field (text summary) |

---

## Step 5: Run the SQL

1. Run `023_prices_jsonb.sql` first (only needed once, adds `prices` JSONB column)
2. Run your insert SQL in Supabase SQL Editor
3. Verify: check the daily sales entries page in the app

---

## Notes

- **Password-protected sheets**: The `xlsx` library can read sheet-protected files (cell protection doesn't block programmatic reading). If the file itself is password-encrypted, you'll need to decrypt it first.
- **"Total" row in closing stock**: Skip the "Total" row from tanks — `ugt_closing_stock` is computed as the sum of individual tank values.
- **Consumption**: Per-pump consumption goes in `nozzle_readings[].consumption`. The breakdown by purpose (S.M, Gen, Logistics, etc.) goes in the `notes` field as a text summary.
- **Banks**: If your banks all have the same name (e.g. all "STANBIC"), map them in order of their UUIDs to Stanbic 1, 2, 3 from the Excel.
- **DPK price**: Often 0 if the station isn't selling DPK during the period.
