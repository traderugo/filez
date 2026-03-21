const ExcelJS = require('exceljs')
const path = require('path')

const REF_FILE = path.join(__dirname, 'output', 'LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx')

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(REF_FILE)

  for (const ws of wb.worksheets) {
    // Check if sheet is protected
    const prot = ws.sheetProtection
    const isProtected = prot && (prot.sheet || prot.objects || prot.scenarios)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`SHEET: ${ws.name}`)
    console.log(`  Protected: ${isProtected ? 'YES' : 'NO'}`)
    if (isProtected) {
      console.log(`  Protection settings:`, JSON.stringify(prot))
    }

    // Find unlocked cells
    const unlocked = []
    const maxRow = Math.min(ws.rowCount || 0, 200)
    const maxCol = Math.min(ws.columnCount || 0, 30)

    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const cell = ws.getRow(r).getCell(c)
        if (cell.protection && cell.protection.locked === false) {
          unlocked.push(`R${r}C${c}`)
        }
      }
    }

    if (unlocked.length > 0) {
      console.log(`  Unlocked cells (${unlocked.length}):`)
      // Show first 30 and summarize
      const shown = unlocked.slice(0, 30)
      console.log(`    ${shown.join(', ')}`)
      if (unlocked.length > 30) console.log(`    ... and ${unlocked.length - 30} more`)

      // Try to find pattern (which columns are unlocked)
      const colCounts = {}
      for (const ref of unlocked) {
        const col = ref.match(/C(\d+)/)[1]
        colCounts[col] = (colCounts[col] || 0) + 1
      }
      console.log(`  Unlocked by column:`, Object.entries(colCounts).map(([c, n]) => `Col${c}:${n}`).join(', '))
    } else {
      console.log(`  No unlocked cells found (all locked by default)`)
    }
  }
}

main().catch(console.error)
