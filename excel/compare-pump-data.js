const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  // --- EXPORTED FILE ---
  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.readFile(path.join(__dirname, 'Audit Report 2026-03-01 to 2026-03-17.xlsx'));
  const expSheet = wb1.getWorksheet('2. Sales>>Cash Position');

  // --- APP FILE ---
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(__dirname, 'Audit Report APP.xlsx'));
  const appSheet = wb2.getWorksheet('Sheet1');

  // APP file: PMS data starts at row 5, groups of 8 pumps separated by blank rows
  // Exported file: PMS data starts at row 10, groups of 8 pumps separated by blank rows

  // Build APP data: collect all PMS rows from Sheet1
  const appGroups = [];
  let currentGroup = [];
  for (let r = 5; r <= 100; r++) {
    const row = appSheet.getRow(r);
    const label = getCellValue(row.getCell(1)); // col A
    if (label && String(label).startsWith('PMS')) {
      currentGroup.push({
        row: r,
        label: String(label),
        opening: getCellValue(row.getCell(2)),
        closing: getCellValue(row.getCell(3)),
        dispensed: getCellValue(row.getCell(4)),
        price: getCellValue(row.getCell(5)),
        amount: getCellValue(row.getCell(6)),
      });
    } else if (currentGroup.length > 0) {
      appGroups.push(currentGroup);
      currentGroup = [];
    }
  }
  if (currentGroup.length > 0) appGroups.push(currentGroup);

  // Build EXPORTED data: collect all PMS rows from rows 10-90
  const expGroups = [];
  currentGroup = [];
  for (let r = 10; r <= 90; r++) {
    const row = expSheet.getRow(r);
    const label = getCellValue(row.getCell('B'));
    if (label && String(label).startsWith('PMS')) {
      const eCell = row.getCell('E');
      const gCell = row.getCell('G');
      currentGroup.push({
        row: r,
        label: String(label),
        opening: getCellValue(row.getCell('C')),
        closing: getCellValue(row.getCell('D')),
        dispensed: eCell.formula ? eCell.value?.result : getCellValue(eCell),
        dispensedFormula: eCell.formula || null,
        price: getCellValue(row.getCell('F')),
        amount: gCell.formula ? gCell.value?.result : getCellValue(gCell),
        amountFormula: gCell.formula || null,
      });
    } else if (currentGroup.length > 0) {
      expGroups.push(currentGroup);
      currentGroup = [];
    }
  }
  if (currentGroup.length > 0) expGroups.push(currentGroup);

  console.log(`APP file: ${appGroups.length} price groups, EXPORTED file: ${expGroups.length} price groups\n`);

  // Compare group by group
  const maxGroups = Math.max(appGroups.length, expGroups.length);
  let totalMismatches = 0;

  for (let g = 0; g < maxGroups; g++) {
    const ag = appGroups[g] || [];
    const eg = expGroups[g] || [];
    const price = ag[0]?.price || eg[0]?.price || '?';
    console.log(`\n${'='.repeat(100)}`);
    console.log(`PRICE GROUP ${g + 1} (Price: ${price})`);
    console.log(`${'='.repeat(100)}`);

    const maxPumps = Math.max(ag.length, eg.length);
    for (let p = 0; p < maxPumps; p++) {
      const a = ag[p];
      const e = eg[p];

      if (!a && e) {
        console.log(`  EXPORTED row ${e.row} ${e.label}: NO APP MATCH`);
        totalMismatches++;
        continue;
      }
      if (a && !e) {
        console.log(`  APP row ${a.row} ${a.label}: NO EXPORTED MATCH`);
        totalMismatches++;
        continue;
      }

      const diffs = [];
      if (a.opening != e.opening) diffs.push(`Opening: APP=${a.opening} EXP=${e.opening}`);
      if (a.closing != e.closing) diffs.push(`Closing: APP=${a.closing} EXP=${e.closing}`);
      if (a.dispensed != e.dispensed) diffs.push(`Dispensed: APP=${a.dispensed} EXP=${e.dispensed} (formula: ${e.dispensedFormula})`);
      if (a.price != e.price) diffs.push(`Price: APP=${a.price} EXP=${e.price}`);
      if (a.amount != e.amount) diffs.push(`Amount: APP=${a.amount} EXP=${e.amount} (formula: ${e.amountFormula})`);

      if (diffs.length > 0) {
        console.log(`  MISMATCH ${a.label} (APP row ${a.row}, EXP row ${e.row}):`);
        diffs.forEach(d => console.log(`    ${d}`));
        totalMismatches++;
      } else {
        console.log(`  OK ${a.label} (APP row ${a.row}, EXP row ${e.row}): open=${a.opening} close=${a.closing} disp=${a.dispensed} price=${a.price} amt=${a.amount}`);
      }
    }
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log(`TOTAL MISMATCHES: ${totalMismatches}`);
  console.log(`${'='.repeat(100)}`);

  // Now specifically inspect exported rows 85-90 formula details
  console.log('\n\nDETAILED FORMULA INSPECTION for exported rows 85-90:');
  console.log('-'.repeat(100));
  for (let r = 85; r <= 90; r++) {
    const row = expSheet.getRow(r);
    const eCell = row.getCell('E');
    const gCell = row.getCell('G');
    const rawE = JSON.stringify(eCell.value);
    const rawG = JSON.stringify(gCell.value);
    console.log(`Row ${r}: B=${getCellValue(row.getCell('B'))} C=${getCellValue(row.getCell('C'))} D=${getCellValue(row.getCell('D'))}`);
    console.log(`  E raw: ${rawE}`);
    console.log(`  G raw: ${rawG}`);
    console.log(`  E.formula=${eCell.formula} E.sharedFormula=${eCell.sharedFormula} E.result=${eCell.result}`);
    console.log(`  G.formula=${gCell.formula} G.sharedFormula=${gCell.sharedFormula} G.result=${gCell.result}`);
  }
}

function getCellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v.formula) return v.result;
    if (v.sharedFormula) return v.result;
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v instanceof Date) return v.toISOString();
    return JSON.stringify(v);
  }
  return v;
}

main().catch(console.error);
