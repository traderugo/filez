const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(__dirname, 'public', 'templates', 'AUDIT REPORT TEMPLATE.xlsx'));

  const results = {};

  wb.eachSheet((sheet) => {
    const sheetHits = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      for (let c = 1; c <= row.cellCount; c++) {
        const cell = row.getCell(c);
        const model = cell.model || cell._value?.model || {};

        const hasSharedFormula = model.sharedFormula !== undefined || cell.sharedFormula;
        const isMaster = model.shareType === 'shared';
        const hasFormula = model.formula || cell.formula;

        if (hasSharedFormula || isMaster) {
          const colLetter = cell.address.replace(/[0-9]/g, '');
          sheetHits.push({
            address: cell.address,
            row: rowNum,
            col: colLetter,
            formula: model.formula || cell.formula || '(none)',
            sharedFormula: model.sharedFormula || cell.sharedFormula || null,
            shareType: model.shareType || null,
            role: isMaster ? 'MASTER' : 'DEPENDENT',
          });
        }
      }
    });

    if (sheetHits.length > 0) {
      results[sheet.name] = sheetHits;
    }
  });

  // Print results
  const sheetNames = Object.keys(results);
  if (sheetNames.length === 0) {
    console.log('No shared formulas found in any sheet.');
    return;
  }

  for (const sheetName of sheetNames) {
    const hits = results[sheetName];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`SHEET: "${sheetName}"  (${hits.length} shared formula cells)`);
    console.log('='.repeat(70));

    const masters = hits.filter(h => h.role === 'MASTER');
    const dependents = hits.filter(h => h.role === 'DEPENDENT');

    if (masters.length > 0) {
      console.log(`\n  MASTERS (${masters.length}):`);
      for (const h of masters) {
        console.log(`    ${h.address}  formula="${h.formula}"`);
      }
    }

    if (dependents.length > 0) {
      console.log(`\n  DEPENDENTS (${dependents.length}):`);
      for (const h of dependents) {
        console.log(`    ${h.address}  sharedFormula="${h.sharedFormula}"  formula="${h.formula}"`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  const totalCells = Object.values(results).reduce((s, h) => s + h.length, 0);
  console.log(`TOTAL: ${totalCells} shared formula cells across ${sheetNames.length} sheet(s)`);
}

main().catch(err => { console.error(err); process.exit(1); });
