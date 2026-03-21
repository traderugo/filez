const ExcelJS = require('exceljs')

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile('output/LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx')

  for (const ws of wb.worksheets) {
    console.log(`\n=== ${ws.name} ===`)
    console.log('Views:', JSON.stringify(ws.views, null, 2))

    // Check fill on a few empty cells
    const emptyCells = []
    for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
      const row = ws.getRow(r)
      for (let c = 1; c <= Math.min(ws.columnCount, 10); c++) {
        const cell = row.getCell(c)
        if (!cell.value && cell.fill && cell.fill.pattern && cell.fill.pattern !== 'none') {
          emptyCells.push({ r, c, fill: cell.fill })
        }
      }
    }
    if (emptyCells.length > 0) {
      console.log('Empty cells with explicit fill:', JSON.stringify(emptyCells.slice(0, 5)))
    } else {
      console.log('No empty cells with explicit fill found in first 20 rows')
    }

    // Also check what the default fill looks like on empty cells
    for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
      for (let c = 1; c <= Math.min(ws.columnCount, 5); c++) {
        const cell = ws.getRow(r).getCell(c)
        if (!cell.value) {
          console.log(`  Empty cell ${String.fromCharCode(64+c)}${r} fill:`, JSON.stringify(cell.fill || 'undefined'))
          break
        }
      }
      break // just one sample
    }
  }
}

main().catch(console.error)
