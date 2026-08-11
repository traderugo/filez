const ExcelJS = require('exceljs')
const path = require('path')

async function inspect() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx'))
  const sheet = wb.getWorksheet('01.08')

  // Group cells by border signature (which border colors used)
  const byBorderColor = { hasGray: [], hasBlackOnly: [], hasMixed: [] }
  for (let r = 1; r <= 50; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = sheet.getCell(r, c)
      const b = cell.border
      if (!b) continue
      const sides = ['top', 'right', 'bottom', 'left']
      const colors = sides.map(s => b[s]?.color?.argb).filter(Boolean)
      const hasGray = colors.includes('FF7F7F7F')
      const hasBlack = colors.includes('FF000000')
      const loc = `R${r}C${c}`
      if (hasGray && hasBlack) byBorderColor.hasMixed.push(loc)
      else if (hasGray) byBorderColor.hasGray.push(loc)
      else if (hasBlack) byBorderColor.hasBlackOnly.push(loc)
    }
  }

  console.log('=== Cells with GRAY borders (no black) ===')
  console.log(byBorderColor.hasGray.length, 'cells')
  console.log(byBorderColor.hasGray.join(', '))

  console.log('\n=== Cells with MIXED gray + black borders ===')
  console.log(byBorderColor.hasMixed.length, 'cells')
  console.log(byBorderColor.hasMixed.join(', '))

  // Detailed inspection of a few specific cells to see their full border
  const inspectCells = [
    [5, 2], [5, 11], [11, 2], [11, 7], [16, 2], [21, 2], [22, 2], [25, 2], [28, 2], [39, 1], [39, 3], [49, 5]
  ]
  console.log('\n=== Specific cells full border ===')
  for (const [r, c] of inspectCells) {
    const cell = sheet.getCell(r, c)
    console.log(`R${r}C${c}:`, JSON.stringify(cell.border)?.substring(0, 300))
  }

  // Row heights
  console.log('\n=== Row heights ===')
  for (let r = 1; r <= 50; r++) {
    const row = sheet.getRow(r)
    if (row.height) console.log(`R${r}: height=${row.height}`)
  }
}

inspect().catch(e => { console.error(e); process.exit(1) })
