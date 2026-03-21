const XlsxPopulate = require('xlsx-populate');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'public', 'templates', 'AUDIT REPORT TEMPLATE.xlsx');
const OUTPUT = path.join(__dirname, 'test-xlsx-populate.xlsx');
const SHEET_NAME = '2. Sales>>Cash Position';

function printRows(sheet, label, startRow, endRow) {
  console.log(`\n=== ${label} (rows ${startRow}-${endRow}) ===`);
  // Print header
  console.log(
    'Row'.padEnd(5),
    'B'.padEnd(15),
    'C'.padEnd(15),
    'D'.padEnd(15),
    'E formula'.padEnd(25),
    'E value'.padEnd(15),
    'F'.padEnd(15),
    'G formula'.padEnd(25),
    'G value'.padEnd(15)
  );
  console.log('-'.repeat(145));

  for (let r = startRow; r <= endRow; r++) {
    const bVal = sheet.cell(`B${r}`).value();
    const cVal = sheet.cell(`C${r}`).value();
    const dVal = sheet.cell(`D${r}`).value();
    const eCell = sheet.cell(`E${r}`);
    const eFormula = eCell.formula();
    const eValue = eCell.value();
    const fVal = sheet.cell(`F${r}`).value();
    const gCell = sheet.cell(`G${r}`);
    const gFormula = gCell.formula();
    const gValue = gCell.value();

    console.log(
      String(r).padEnd(5),
      String(bVal ?? '').padEnd(15),
      String(cVal ?? '').padEnd(15),
      String(dVal ?? '').padEnd(15),
      String(eFormula ?? '(none)').padEnd(25),
      String(eValue ?? '').padEnd(15),
      String(fVal ?? '').padEnd(15),
      String(gFormula ?? '(none)').padEnd(25),
      String(gValue ?? '').padEnd(15)
    );
  }
}

async function main() {
  // Step 1: Load template and inspect
  console.log('Loading template:', TEMPLATE);
  const wb = await XlsxPopulate.fromFileAsync(TEMPLATE);

  const sheetNames = wb.sheets().map(s => s.name());
  console.log('Sheets:', sheetNames);

  const sheet = wb.sheet(SHEET_NAME);
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found!`);
    process.exit(1);
  }

  printRows(sheet, 'BEFORE modification', 10, 20);

  // Step 2: Write test data to row 10
  console.log('\n>>> Writing test data: C10=1000, D10=2000, F10=500');
  sheet.cell('C10').value(1000);
  sheet.cell('D10').value(2000);
  sheet.cell('F10').value(500);

  // Step 3: Save
  console.log('Saving to:', OUTPUT);
  await wb.toFileAsync(OUTPUT);
  console.log('Saved successfully.');

  // Step 4: Re-open and verify
  console.log('\nRe-opening saved file...');
  const wb2 = await XlsxPopulate.fromFileAsync(OUTPUT);
  const sheet2 = wb2.sheet(SHEET_NAME);

  printRows(sheet2, 'AFTER save & re-open', 10, 20);

  // Step 5: Verify formulas
  console.log('\n=== VERIFICATION ===');
  const e10 = sheet2.cell('E10');
  const g10 = sheet2.cell('G10');
  const e11 = sheet2.cell('E11');
  const g11 = sheet2.cell('G11');
  const e15 = sheet2.cell('E15');
  const g15 = sheet2.cell('G15');

  console.log(`E10 formula: ${e10.formula() ?? '(none)'}  value: ${e10.value()}`);
  console.log(`G10 formula: ${g10.formula() ?? '(none)'}  value: ${g10.value()}`);
  console.log(`E11 formula: ${e11.formula() ?? '(none)'}  value: ${e11.value()}`);
  console.log(`G11 formula: ${g11.formula() ?? '(none)'}  value: ${g11.value()}`);
  console.log(`E15 formula: ${e15.formula() ?? '(none)'}  value: ${e15.value()}`);
  console.log(`G15 formula: ${g15.formula() ?? '(none)'}  value: ${g15.value()}`);

  // Check E10 references row 10
  const e10f = e10.formula();
  if (e10f && /10/.test(e10f)) {
    console.log('\n[PASS] E10 formula references row 10');
  } else if (e10f) {
    console.log(`\n[WARN] E10 formula "${e10f}" may not reference row 10 correctly`);
  } else {
    console.log('\n[FAIL] E10 has no formula');
  }

  // Check E11 references row 11 (not corrupted to row 10)
  const e11f = e11.formula();
  if (e11f && /11/.test(e11f)) {
    console.log('[PASS] E11 formula references row 11 (not corrupted)');
  } else if (e11f) {
    console.log(`[WARN] E11 formula "${e11f}" may be corrupted (should reference row 11)`);
  } else {
    console.log('[FAIL] E11 has no formula');
  }

  // Check E15 references row 15
  const e15f = e15.formula();
  if (e15f && /15/.test(e15f)) {
    console.log('[PASS] E15 formula references row 15 (not corrupted)');
  } else if (e15f) {
    console.log(`[WARN] E15 formula "${e15f}" may be corrupted (should reference row 15)`);
  } else {
    console.log('[FAIL] E15 has no formula');
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
