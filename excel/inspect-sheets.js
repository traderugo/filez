const ExcelJS = require('exceljs');
const path = require('path');

async function inspect(filePath, label) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}: ${path.basename(filePath)}`);
  console.log(`${'='.repeat(60)}`);
  wb.eachSheet(sheet => {
    console.log(`\n--- Sheet: "${sheet.name}" (rows: ${sheet.rowCount}, cols: ${sheet.columnCount}) ---`);
    // Print first 8 rows
    for (let r = 1; r <= Math.min(8, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      const cells = [];
      for (let c = 1; c <= Math.min(15, sheet.columnCount); c++) {
        let v = row.getCell(c).value;
        if (v && typeof v === 'object' && 'formula' in v) v = v.result;
        if (v && typeof v === 'object' && 'richText' in v) v = v.richText.map(x => x.text).join('');
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
        if (v === null || v === undefined) v = '';
        cells.push(String(v).substring(0, 25));
      }
      console.log(`  R${r}: ${cells.join(' | ')}`);
    }
  });
}

async function main() {
  await inspect(path.join(__dirname, 'Audit Report APP.xlsx'), 'FILE 1 (APP)');
  await inspect(path.join(__dirname, 'Audit Report 2026-03-01 to 2026-03-17.xlsx'), 'FILE 2 (Exported)');
}

main().catch(e => { console.error(e); process.exit(1); });
