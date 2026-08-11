const ExcelJS = require('exceljs')
const path = require('path')

async function inspect() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx'))

  // Try several sheets to see if formulas differ
  for (const name of ['01.08', '02.08', '03.08', '15.08']) {
    const sheet = wb.getWorksheet(name)
    if (!sheet) continue
    console.log(`\n=== Sheet: ${name} ===`)
    for (let row of [16, 17, 18, 28]) {
      console.log(`\nRow ${row}:`)
      for (let col = 4; col <= 6; col++) {
        const cell = sheet.getCell(row, col)
        const val = cell.value
        console.log(`  Col ${String.fromCharCode(64 + col)}:`, JSON.stringify(val)?.substring(0, 200))
      }
    }
  }
}

inspect().catch(e => { console.error(e); process.exit(1) })
