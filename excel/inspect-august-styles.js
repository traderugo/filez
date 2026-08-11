const ExcelJS = require('exceljs')
const path = require('path')

async function inspect() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx'))
  const sheet = wb.getWorksheet('01.08')

  // Workbook-level defaults
  console.log('=== Workbook properties ===')
  console.log('defaultFontName:', wb.properties?.defaultFontName)

  // Column widths
  console.log('\n=== Column widths ===')
  for (let c = 1; c <= 11; c++) {
    const col = sheet.getColumn(c)
    console.log(`  Col ${String.fromCharCode(64 + c)}: width=${col.width}`)
  }

  // Inspect specific landmark cells
  const landmarks = [
    { r: 1, c: 2, label: 'R1C2 (Station label)' },
    { r: 1, c: 3, label: 'R1C3 (Station value)' },
    { r: 2, c: 2, label: 'R2C2 (Date label)' },
    { r: 2, c: 3, label: 'R2C3 (Date value)' },
    { r: 2, c: 7, label: 'R2C7 (Opening Time value)' },
    { r: 4, c: 2, label: 'R4C2 (Price 1 header)' },
    { r: 4, c: 11, label: 'R4C11 (Amount header)' },
    { r: 5, c: 1, label: 'R5C1 (PMS label)' },
    { r: 5, c: 2, label: 'R5C2 (Price 1 value 595)' },
    { r: 5, c: 11, label: 'R5C11 (Amount formula)' },
    { r: 9, c: 1, label: 'R9C1 (STOCK INVENTORY section title)' },
    { r: 10, c: 2, label: 'R10C2 (Opening stock header)' },
    { r: 11, c: 2, label: 'R11C2 (Opening stock value)' },
    { r: 14, c: 1, label: 'R14C1 (STOCK RECON title)' },
    { r: 20, c: 2, label: 'R20C2 (Deposit 1 header)' },
    { r: 21, c: 2, label: 'R21C2 (Deposit 1 value)' },
    { r: 22, c: 2, label: 'R22C2 (Bank name)' },
    { r: 23, c: 1, label: 'R23C1 (CASH RECON title)' },
    { r: 25, c: 9, label: 'R25C9 (Reason cell)' },
    { r: 37, c: 1, label: 'R37C1 (LUBE BREAKDOWN title)' },
    { r: 39, c: 1, label: 'R39C1 (First lube product)' },
  ]

  for (const lm of landmarks) {
    const cell = sheet.getCell(lm.r, lm.c)
    console.log(`\n--- ${lm.label} ---`)
    console.log('  value:', JSON.stringify(cell.value)?.substring(0, 80))
    console.log('  font:', JSON.stringify(cell.font))
    console.log('  fill:', JSON.stringify(cell.fill))
    console.log('  alignment:', JSON.stringify(cell.alignment))
    console.log('  numFmt:', cell.numFmt)
    console.log('  border:', JSON.stringify(cell.border)?.substring(0, 200))
  }

  // Merged cells
  console.log('\n=== ALL Merged ranges ===')
  const merges = sheet.model.merges || []
  for (let i = 0; i < merges.length; i++) {
    console.log(' ', merges[i])
  }
}

inspect().catch(e => { console.error(e); process.exit(1) })
