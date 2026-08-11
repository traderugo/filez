const ExcelJS = require('exceljs')
const path = require('path')

async function inspect() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx'))
  const sheet = wb.getWorksheet('01.08')

  // Inspect A1, A2 (the corner cell)
  console.log('=== A1, A2 corner ===')
  for (let r of [1, 2]) {
    const cell = sheet.getCell(r, 1)
    console.log(`R${r}C1:`, JSON.stringify(cell.value)?.substring(0, 200))
  }

  // Inspect TOTAL row of lube section
  console.log('\n=== TOTAL row (R49 on 01.08) — all columns ===')
  for (let c = 1; c <= 11; c++) {
    const cell = sheet.getCell(49, c)
    console.log(`R49C${c}:`, JSON.stringify(cell.value)?.substring(0, 200))
  }

  // Also scan all formulas in sheet 01.08 for any that look broken
  console.log('\n=== All non-shared formulas in sheet 01.08 ===')
  for (let r = 1; r <= 55; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = sheet.getCell(r, c)
      const v = cell.value
      if (v && typeof v === 'object' && v.formula) {
        console.log(`R${r}C${c}: =${v.formula} [result=${JSON.stringify(v.result)}]`)
      }
    }
  }
}

inspect().catch(e => { console.error(e); process.exit(1) })
