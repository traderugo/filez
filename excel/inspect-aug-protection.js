const ExcelJS = require('exceljs')
const path = require('path')

async function inspect() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx'))
  const sheet = wb.getWorksheet('01.08')

  console.log('=== Sheet protection (01.08) ===')
  console.log(JSON.stringify(sheet.model.sheetProtection || 'NOT PROTECTED'))

  console.log('\n=== Cell protection samples ===')
  const samples = [
    [1, 1], [1, 3], [2, 3], [2, 7],
    [4, 2], [5, 1], [5, 2], [5, 11],
    [8, 11], [11, 2], [11, 5], [11, 6], [11, 7],
    [16, 2], [21, 2], [22, 2],
    [25, 2], [25, 3], [25, 7], [25, 9],
    [28, 2], [28, 3], [28, 4],
    [34, 2], [39, 1], [39, 3], [39, 7], [39, 9], [39, 10],
    [49, 5],
  ]
  for (const [r, c] of samples) {
    const cell = sheet.getCell(r, c)
    const isFormula = cell.value && typeof cell.value === 'object' && cell.value.formula
    console.log(`R${r}C${c}: protection=${JSON.stringify(cell.protection)} isFormula=${!!isFormula}`)
  }

  console.log('\n=== Row heights ===')
  for (let r = 1; r <= 55; r++) {
    const row = sheet.getRow(r)
    console.log(`R${r}: height=${row.height} hidden=${row.hidden}`)
  }
}

inspect().catch(e => { console.error(e); process.exit(1) })
