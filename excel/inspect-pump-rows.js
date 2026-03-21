const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  // --- EXPORTED FILE ---
  console.log('='.repeat(120));
  console.log('EXPORTED FILE: Audit Report 2026-03-01 to 2026-03-17.xlsx');
  console.log('Sheet: "2. Sales>>Cash Position"');
  console.log('='.repeat(120));

  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.readFile(path.join(__dirname, 'Audit Report 2026-03-01 to 2026-03-17.xlsx'));

  const sheet1 = wb1.getWorksheet('2. Sales>>Cash Position');
  if (!sheet1) {
    console.log('Sheet not found! Available sheets:');
    wb1.eachSheet((s) => console.log(`  - "${s.name}"`));
  } else {
    console.log(`\nRows 10-90, Columns B-G (Label, Opening, Closing, Dispensed, Price, Amount)\n`);
    console.log(
      'ROW'.padEnd(5),
      'B (Label)'.padEnd(30),
      'C (Opening)'.padEnd(25),
      'D (Closing)'.padEnd(25),
      'E (Dispensed)'.padEnd(45),
      'F (Price)'.padEnd(25),
      'G (Amount)'.padEnd(45)
    );
    console.log('-'.repeat(200));

    for (let r = 10; r <= 90; r++) {
      const row = sheet1.getRow(r);
      const cells = {};
      for (const col of ['B', 'C', 'D', 'E', 'F', 'G']) {
        const cell = row.getCell(col);
        cells[col] = formatCell(cell);
      }

      // Skip rows where ALL cells are empty
      const allEmpty = Object.values(cells).every(v => v === '(empty)');
      if (allEmpty) continue;

      console.log(
        String(r).padEnd(5),
        cells.B.padEnd(30),
        cells.C.padEnd(25),
        cells.D.padEnd(25),
        cells.E.padEnd(45),
        cells.F.padEnd(25),
        cells.G.padEnd(45)
      );
    }
  }

  // --- APP FILE ---
  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('APP FILE: Audit Report APP.xlsx');
  console.log('='.repeat(120));

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(__dirname, 'Audit Report APP.xlsx'));

  console.log('\nAvailable sheets:');
  wb2.eachSheet((s) => console.log(`  - "${s.name}"`));

  // Try to find the matching sheet
  let appSheet = wb2.getWorksheet('2. Sales>>Cash Position');
  if (!appSheet) {
    // Try partial match
    wb2.eachSheet((s) => {
      if (s.name.toLowerCase().includes('sales') || s.name.toLowerCase().includes('cash')) {
        appSheet = s;
      }
    });
  }
  if (!appSheet) {
    // Just use the first sheet or iterate all
    console.log('\nNo matching sheet found. Searching all sheets for PMS meter data...\n');
    wb2.eachSheet((s) => {
      console.log(`\n--- Sheet: "${s.name}" ---`);
      // Look for PMS references
      for (let r = 1; r <= Math.min(s.rowCount, 150); r++) {
        const row = s.getRow(r);
        for (let c = 1; c <= 10; c++) {
          const cell = row.getCell(c);
          const val = getCellValue(cell);
          if (val && String(val).toLowerCase().includes('pms')) {
            console.log(`  Found "PMS" at row ${r}, col ${c}: ${val}`);
            // Print surrounding rows
            for (let rr = Math.max(1, r - 2); rr <= Math.min(s.rowCount, r + 30); rr++) {
              const rrow = s.getRow(rr);
              const vals = [];
              for (let cc = 1; cc <= 10; cc++) {
                vals.push(formatCell(rrow.getCell(cc)));
              }
              if (!vals.every(v => v === '(empty)')) {
                console.log(`    Row ${rr}: ${vals.join(' | ')}`);
              }
            }
            break;
          }
        }
      }
    });
  } else {
    console.log(`\nFound sheet: "${appSheet.name}"`);
    console.log(`Rows 10-90, Columns B-G\n`);
    console.log(
      'ROW'.padEnd(5),
      'B (Label)'.padEnd(30),
      'C (Opening)'.padEnd(25),
      'D (Closing)'.padEnd(25),
      'E (Dispensed)'.padEnd(45),
      'F (Price)'.padEnd(25),
      'G (Amount)'.padEnd(45)
    );
    console.log('-'.repeat(200));

    for (let r = 10; r <= 90; r++) {
      const row = appSheet.getRow(r);
      const cells = {};
      for (const col of ['B', 'C', 'D', 'E', 'F', 'G']) {
        const cell = row.getCell(col);
        cells[col] = formatCell(cell);
      }
      const allEmpty = Object.values(cells).every(v => v === '(empty)');
      if (allEmpty) continue;

      console.log(
        String(r).padEnd(5),
        cells.B.padEnd(30),
        cells.C.padEnd(25),
        cells.D.padEnd(25),
        cells.E.padEnd(45),
        cells.F.padEnd(25),
        cells.G.padEnd(45)
      );
    }
  }
}

function formatCell(cell) {
  if (cell.formula) {
    const cached = cell.result !== undefined && cell.result !== null ? cell.result : cell.value?.result;
    return `FORMULA: ${cell.formula} | CACHED: ${cached}`;
  }
  if (cell.sharedFormula) {
    const cached = cell.result !== undefined && cell.result !== null ? cell.result : cell.value?.result;
    return `SHARED: ${cell.sharedFormula} | CACHED: ${cached}`;
  }
  const val = getCellValue(cell);
  if (val === null || val === undefined || val === '') return '(empty)';
  return `VALUE: ${val}`;
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
