const ExcelJS = require('exceljs');
const path = require('path');

const FILE1 = path.join(__dirname, 'Audit Report APP.xlsx');
const FILE2 = path.join(__dirname, 'Audit Report 2026-03-01 to 2026-03-17.xlsx');

/**
 * Extract a clean value from an ExcelJS cell.
 * For formula cells, use .result. Handle shared formulas that have no result.
 */
function getCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  let val = cell.value;

  // Formula cell
  if (val && typeof val === 'object' && 'formula' in val) {
    val = val.result !== undefined && val.result !== null ? val.result : null;
  }
  // Shared formula only (no master formula, no result) — treat as null/unresolved
  if (val && typeof val === 'object' && 'sharedFormula' in val) {
    val = val.result !== undefined && val.result !== null ? val.result : null;
  }
  // Rich text
  if (val && typeof val === 'object' && 'richText' in val) {
    val = val.richText.map(r => r.text).join('');
  }
  // Date
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  // Error
  if (val && typeof val === 'object' && 'error' in val) return `#ERROR`;
  // Remaining object
  if (val && typeof val === 'object') return null;
  // Number
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  // String
  if (typeof val === 'string') return val.trim() || null;
  return val;
}

/**
 * Read a row as an array of clean values from colStart to colEnd.
 */
function readRow(sheet, r, colStart, colEnd) {
  const cells = [];
  const row = sheet.getRow(r);
  for (let c = colStart; c <= colEnd; c++) {
    cells.push(getCellValue(row.getCell(c)));
  }
  return cells;
}

/**
 * Compare two value arrays. Returns array of { colIndex, v1, v2 }.
 */
function compareRows(arr1, arr2) {
  const diffs = [];
  const len = Math.max(arr1.length, arr2.length);
  for (let i = 0; i < len; i++) {
    const v1 = i < arr1.length ? arr1[i] : null;
    const v2 = i < arr2.length ? arr2[i] : null;
    if (v1 === null && v2 === null) continue;
    let same = v1 === v2;
    if (!same && typeof v1 === 'number' && typeof v2 === 'number') same = Math.abs(v1 - v2) < 0.01;
    if (!same && v1 !== null && v2 !== null && String(v1) === String(v2)) same = true;
    if (!same) diffs.push({ col: i, v1, v2 });
  }
  return diffs;
}

async function main() {
  const wb1 = new ExcelJS.Workbook();
  const wb2 = new ExcelJS.Workbook();
  await wb1.xlsx.readFile(FILE1);
  await wb2.xlsx.readFile(FILE2);

  const app = wb1.getWorksheet('Sheet1');
  const exp = wb2.getWorksheet('2. Sales>>Cash Position');

  // APP layout:  col A(1)=label, B(2)=opening, C(3)=closing, D(4)=dispensed, E(5)=price, F(6)=amount
  // EXP layout:  col B(2)=label, C(3)=opening, D(4)=closing, E(5)=dispensed, F(6)=price, G(7)=amount

  // Build structured rows from APP
  const appRows = [];
  for (let r = 1; r <= app.rowCount; r++) {
    const label = getCellValue(app.getRow(r).getCell(1));
    const data = readRow(app, r, 2, 6); // cols B-F = opening, closing, dispensed, price, amount
    appRows.push({ r, label, data });
  }

  // Build structured rows from EXP (skip rows that are just repeated formula artifacts)
  const expRows = [];
  for (let r = 1; r <= exp.rowCount; r++) {
    const label = getCellValue(exp.getRow(r).getCell(2)); // col B
    const data = readRow(exp, r, 3, 7); // cols C-G = opening, closing, dispensed, price, amount
    expRows.push({ r, label, data });
  }

  console.log('========================================');
  console.log('AUDIT REPORT COMPARISON');
  console.log('========================================');
  console.log(`APP (Sheet1): ${app.rowCount} rows`);
  console.log(`Exported (2. Sales>>Cash Position): ${exp.rowCount} rows`);
  console.log('');

  // Strategy: match by label + data pattern.
  // APP rows have labels like "PMS 1", "AGO 1", "DPK 1", "Meter Reading", "A", "B", "C=A-B", "D", "E=C-D"
  // and section headers like "1. PMS Sales for the Period"
  // EXP rows have the same labels in col B.
  //
  // Due to spacing differences, match sequentially: walk both in order, skip empty/header rows.

  // First, let's identify the data rows in each file (rows with a label in the label column)
  const appDataRows = appRows.filter(r => r.label !== null);
  const expDataRows = expRows.filter(r => r.label !== null);

  console.log(`APP data rows: ${appDataRows.length}`);
  console.log(`Exported data rows: ${expDataRows.length}`);
  console.log('');

  // Match by label sequentially
  let expIdx = 0;
  let totalDiffs = 0;
  let matchedCount = 0;
  const unmatchedApp = [];
  const colNames = ['Opening', 'Closing', 'Dispensed', 'Price', 'Amount'];

  for (const appRow of appDataRows) {
    const appLabel = String(appRow.label).toLowerCase().replace(/\s+/g, ' ').trim();

    // Find matching label in exported, searching forward from current position
    let found = false;
    for (let j = expIdx; j < expDataRows.length; j++) {
      const expLabel = String(expDataRows[j].label).toLowerCase().replace(/\s+/g, ' ').trim();

      if (appLabel === expLabel ||
          (appLabel.includes('sales for the period') && expLabel.includes('sales for the period') &&
           appLabel.charAt(0) === expLabel.charAt(0))) {
        // Match found
        matchedCount++;
        expIdx = j + 1;

        const diffs = compareRows(appRow.data, expDataRows[j].data);
        if (diffs.length > 0) {
          for (const d of diffs) {
            const colName = d.col < colNames.length ? colNames[d.col] : `Col${d.col + 2}`;
            console.log(`DIFF | "${appRow.label}" [${colName}] | APP(R${appRow.r}): ${JSON.stringify(d.v1)} | Exported(R${expDataRows[j].r}): ${JSON.stringify(d.v2)}`);
            totalDiffs++;
          }
        }
        found = true;
        break;
      }
    }

    if (!found) {
      unmatchedApp.push(appRow);
    }
  }

  // Check for unmatched exported rows
  const matchedExpRows = new Set();
  expIdx = 0;
  for (const appRow of appDataRows) {
    const appLabel = String(appRow.label).toLowerCase().replace(/\s+/g, ' ').trim();
    for (let j = expIdx; j < expDataRows.length; j++) {
      const expLabel = String(expDataRows[j].label).toLowerCase().replace(/\s+/g, ' ').trim();
      if (appLabel === expLabel ||
          (appLabel.includes('sales for the period') && expLabel.includes('sales for the period') &&
           appLabel.charAt(0) === expLabel.charAt(0))) {
        matchedExpRows.add(j);
        expIdx = j + 1;
        break;
      }
    }
  }

  const unmatchedExp = expDataRows.filter((_, i) => !matchedExpRows.has(i));

  console.log('');
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Matched rows: ${matchedCount}`);
  console.log(`Data differences: ${totalDiffs}`);
  console.log(`Unmatched APP rows: ${unmatchedApp.length}`);
  console.log(`Unmatched Exported rows: ${unmatchedExp.length}`);

  if (unmatchedApp.length > 0) {
    console.log('\n--- Rows only in APP ---');
    for (const r of unmatchedApp) {
      const vals = r.data.filter(v => v !== null).join(', ');
      console.log(`  R${r.r}: "${r.label}" => ${vals}`);
    }
  }

  if (unmatchedExp.length > 0) {
    console.log('\n--- Rows only in Exported ---');
    for (const r of unmatchedExp) {
      const vals = r.data.filter(v => v !== null).join(', ');
      console.log(`  R${r.r}: "${r.label}" => ${vals}`);
    }
  }

  // Also check the other sheets in the exported file that have no APP counterpart
  console.log('\n\n========================================');
  console.log('OTHER EXPORTED SHEETS (no APP counterpart)');
  console.log('========================================');

  const otherSheets = [
    '3.Stock Position',
    '4.Lodgement Sheet',
    '5.PMS Consumption and Pour back',
    '6.AGO Consumption and Pour back',
    '7.DPK Consumption and Pour back',
    '8.Product Received',
    '9.Expenses for the Month',
    '10.Record of Stock Position',
    "Customers' Ledger",
    'Castro Lubricants',
  ];

  for (const name of otherSheets) {
    const sheet = wb2.getWorksheet(name);
    if (sheet) {
      let dataCells = 0;
      for (let r = 1; r <= sheet.rowCount; r++) {
        for (let c = 1; c <= sheet.columnCount; c++) {
          if (getCellValue(sheet.getRow(r).getCell(c)) !== null) dataCells++;
        }
      }
      console.log(`  "${name}": ${sheet.rowCount} rows, ${dataCells} data cells — NO COMPARISON (only in Exported)`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
