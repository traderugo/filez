const ExcelJS = require('exceljs')
const path = require('path')

const REF_FILE = path.join(__dirname, 'output', 'LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx')

function borderStr(b) {
  if (!b) return 'NONE'
  const t = b.top?.style || '-'
  const bo = b.bottom?.style || '-'
  const l = b.left?.style || '-'
  const r = b.right?.style || '-'
  if (t === '-' && bo === '-' && l === '-' && r === '-') return 'NONE'
  return `T:${t}|B:${bo}|L:${l}|R:${r}`
}

function cellInfo(cell) {
  const val = cell.value
  let type = 'empty'
  let display = ''
  if (val && typeof val === 'object' && val.formula) {
    type = 'formula'
    display = val.formula.substring(0, 40)
  } else if (val !== null && val !== undefined && val !== '') {
    type = typeof val
    display = String(val).substring(0, 30)
  }
  return { type, display }
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(REF_FILE)

  // ─── Sales>>Cash Position: find the reconciliation/summary section ───
  const sales = wb.getWorksheet('2. Sales>>Cash Position')
  if (sales) {
    console.log('\n' + '='.repeat(80))
    console.log('SALES>>CASH POSITION — FULL BORDER DUMP (rows 1-250, cols B-H)')
    console.log('='.repeat(80))

    // Find where "RECONCILIATION" or summary starts by scanning for keywords
    const maxRow = Math.min(sales.rowCount || 0, 250)
    for (let r = 1; r <= maxRow; r++) {
      const rowCells = []
      let hasContent = false
      for (let c = 2; c <= 8; c++) {
        const cell = sales.getRow(r).getCell(c)
        const info = cellInfo(cell)
        const brd = borderStr(cell.border)
        if (info.type !== 'empty' || brd !== 'NONE') hasContent = true
        rowCells.push({ c, info, brd })
      }
      if (hasContent) {
        console.log(`\n  Row ${r}:`)
        for (const { c, info, brd } of rowCells) {
          if (info.type !== 'empty' || brd !== 'NONE') {
            console.log(`    Col${c}: [${info.type}] ${info.display || '(empty)'} | border: ${brd}`)
          }
        }
      }
    }
  }

  // ─── Stock Position: full dump ───
  const stock = wb.getWorksheet('3.Stock Position')
  if (stock) {
    console.log('\n' + '='.repeat(80))
    console.log('STOCK POSITION — FULL BORDER DUMP (rows 1-90, cols B-E)')
    console.log('='.repeat(80))

    const maxRow = Math.min(stock.rowCount || 0, 90)
    for (let r = 1; r <= maxRow; r++) {
      const rowCells = []
      let hasContent = false
      for (let c = 2; c <= 5; c++) {
        const cell = stock.getRow(r).getCell(c)
        const info = cellInfo(cell)
        const brd = borderStr(cell.border)
        if (info.type !== 'empty' || brd !== 'NONE') hasContent = true
        rowCells.push({ c, info, brd })
      }
      if (hasContent) {
        console.log(`\n  Row ${r}:`)
        for (const { c, info, brd } of rowCells) {
          if (info.type !== 'empty' || brd !== 'NONE') {
            console.log(`    Col${c}: [${info.type}] ${info.display || '(empty)'} | border: ${brd}`)
          }
        }
      }
    }
  }
}

main().catch(console.error)
