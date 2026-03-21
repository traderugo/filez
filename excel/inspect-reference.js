const ExcelJS = require('exceljs')
const path = require('path')

const REF_FILE = path.join(__dirname, 'output', 'LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx')

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(REF_FILE)

  for (const ws of wb.worksheets) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`SHEET: ${ws.name}`)
    console.log('='.repeat(70))

    // Column widths
    console.log('\n  COLUMN WIDTHS:')
    for (let c = 1; c <= ws.columnCount; c++) {
      const w = ws.getColumn(c).width
      if (w) console.log(`    Col ${c}: ${w}`)
    }

    // Unique number formats (with cell references)
    const numFmts = {}
    const fills = {}
    const maxRow = ws.rowCount || 0
    const maxCol = ws.columnCount || 0

    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const cell = ws.getRow(r).getCell(c)

        // Number formats
        if (cell.numFmt && cell.numFmt !== 'General') {
          if (!numFmts[cell.numFmt]) numFmts[cell.numFmt] = []
          if (numFmts[cell.numFmt].length < 5) {
            numFmts[cell.numFmt].push(`R${r}C${c}`)
          }
        }

        // Fills (non-none)
        if (cell.fill && cell.fill.pattern && cell.fill.pattern !== 'none') {
          const fg = cell.fill.fgColor ? (cell.fill.fgColor.argb || `theme:${cell.fill.fgColor.theme}`) : 'none'
          const key = `${cell.fill.pattern}:${fg}`
          if (!fills[key]) fills[key] = []
          if (fills[key].length < 10) {
            fills[key].push(`R${r}C${c}`)
          } else if (fills[key].length === 10) {
            fills[key].push('...')
          }
        }
      }
    }

    console.log('\n  NUMBER FORMATS:')
    for (const [fmt, cells] of Object.entries(numFmts)) {
      console.log(`    "${fmt}" → ${cells.join(', ')} (+ more)`)
    }

    console.log('\n  FILLS:')
    for (const [fill, cells] of Object.entries(fills)) {
      console.log(`    ${fill} → ${cells.join(', ')}`)
    }

    // Border patterns on specific rows (first data row, last data row, total row)
    // Just show the first 2 data rows to understand the pattern
    const dataStartRow = ws.name.includes('Sales') ? 10 :
                          ws.name.includes('Stock') ? 7 :
                          ws.name.includes('Lodgement') ? 11 :
                          ws.name.includes('Consumption') ? 6 :
                          ws.name.includes('Product') ? 7 :
                          ws.name.includes('Expense') ? 7 :
                          ws.name.includes('Record') ? 7 :
                          ws.name.includes('Customer') ? 8 :
                          ws.name.includes('Castro') ? 7 : 5

    console.log(`\n  BORDER PATTERN (rows ${dataStartRow}-${dataStartRow+1}):`)
    for (let r = dataStartRow; r <= Math.min(dataStartRow + 1, maxRow); r++) {
      for (let c = 1; c <= Math.min(maxCol, 10); c++) {
        const cell = ws.getRow(r).getCell(c)
        if (cell.border) {
          const t = cell.border.top?.style || 'none'
          const b = cell.border.bottom?.style || 'none'
          const l = cell.border.left?.style || 'none'
          const ri = cell.border.right?.style || 'none'
          if (t !== 'none' || b !== 'none' || l !== 'none' || ri !== 'none') {
            console.log(`    R${r}C${c}: T:${t}|B:${b}|L:${l}|R:${ri}`)
          }
        }
      }
    }
  }
}

main().catch(console.error)
