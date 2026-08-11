const ExcelJS = require('exceljs');
const path = require('path');

async function inspect(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(`\nFILE: ${path.basename(filePath)}`);
  console.log('='.repeat(80));

  wb.eachSheet(sheet => {
    console.log(`\n--- Sheet: "${sheet.name}" (rows: ${sheet.rowCount}, cols: ${sheet.columnCount}) ---`);
    const maxRows = Math.min(sheet.rowCount, 60);
    const maxCols = Math.min(sheet.columnCount, 20);
    for (let r = 1; r <= maxRows; r++) {
      const row = sheet.getRow(r);
      const cells = [];
      for (let c = 1; c <= maxCols; c++) {
        let v = row.getCell(c).value;
        if (v && typeof v === 'object' && 'formula' in v) v = '=' + v.formula + (v.result !== undefined ? ` [${v.result}]` : '');
        if (v && typeof v === 'object' && 'richText' in v) v = v.richText.map(x => x.text).join('');
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
        if (v === null || v === undefined) v = '';
        cells.push(String(v).substring(0, 30));
      }
      console.log(`  R${String(r).padStart(2)}: ${cells.join(' | ')}`);
    }
  });
}

async function main() {
  const file = path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx');
  await inspect(file);
}

main().catch(e => { console.error(e); process.exit(1); });
