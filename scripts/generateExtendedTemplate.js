/**
 * Generate an extended audit report template with double pump rows
 * for each fuel type in Sheet 2, using ExcelJS to preserve formatting.
 *
 * Run: node scripts/generateExtendedTemplate.js
 *
 * PMS: 77 → 154 pump rows
 * AGO: 28 → 56 pump rows
 * DPK: 23 → 46 pump rows
 */
const ExcelJS = require('exceljs')
const path = require('path')

const INPUT = path.join(__dirname, '..', 'public', 'templates', 'AUDIT REPORT TEMPLATE.xlsx')
const OUTPUT = path.join(__dirname, '..', 'public', 'templates', 'AUDIT REPORT TEMPLATE (EXTENDED).xlsx')

const SHEET_NAME = '2. Sales>>Cash Position'

// Insertion config (1-indexed rows in the ORIGINAL template)
// Work bottom-up so earlier insertions don't shift later targets
const INSERTIONS = [
  { after: 207, count: 23, label: 'DPK' },
  { after: 146, count: 28, label: 'AGO' },
  { after: 85,  count: 77, label: 'PMS' },
]

/** Convert all shared formulas to regular formulas in a worksheet */
function unshareFormulas(ws) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.sharedFormula) {
        // sharedFormula means this cell is a clone referencing a master
        // We need to resolve it to a regular formula
        // ExcelJS stores the resolved formula in cell.formula for masters
        // For clones, we need to compute it from the master
      }
      if (cell.formula) {
        // Force it to be a non-shared formula by re-assigning
        const f = cell.formula
        const result = cell.result
        cell.value = { formula: f, result }
      }
    })
  })
}

/**
 * Copy styles from a source row to a target row.
 * Does not copy values or formulas — only formatting.
 */
function copyRowStyle(srcRow, dstRow) {
  dstRow.height = srcRow.height
  srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
    const dstCell = dstRow.getCell(colNum)
    if (srcCell.style) {
      dstCell.style = JSON.parse(JSON.stringify(srcCell.style))
    }
  })
}

function finalRow(origRow) {
  let r = origRow
  if (origRow > 85) r += 77
  if (origRow > 146) r += 28
  if (origRow > 207) r += 23
  return r
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(INPUT)

  const ws = wb.getWorksheet(SHEET_NAME)
  if (!ws) {
    console.error(`Sheet "${SHEET_NAME}" not found`)
    process.exit(1)
  }

  // Convert shared formulas to regular formulas to avoid clone errors
  unshareFormulas(ws)

  // Process bottom-up
  for (const { after, count, label } of INSERTIONS) {
    console.log(`${label}: inserting ${count} rows after row ${after}...`)

    // Get the source row to copy style from
    const srcRow = ws.getRow(after)

    // duplicateRow: copies the row N times below it, shifting everything down
    ws.duplicateRow(after, count, true)

    // The new rows are at (after+1) through (after+count)
    // Clear data values but keep formulas (E=D-C, G=E*F) and styles
    for (let i = 1; i <= count; i++) {
      const row = ws.getRow(after + i)
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        if (cell.formula) {
          // Keep pump formulas (E and G columns)
          // They're already adjusted by duplicateRow
        } else {
          cell.value = null
        }
      })
    }
  }

  // Fix cross-sheet references to Sheet 2 from other sheets
  const sheetRef = "'2. Sales>>Cash Position'!"

  wb.eachSheet((otherWs) => {
    if (otherWs.name === SHEET_NAME) return

    otherWs.eachRow((row) => {
      row.eachCell((cell) => {
        if (!cell.formula) return
        if (!cell.formula.includes(sheetRef)) return

        const escaped = sheetRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        cell.formula = cell.formula.replace(
          new RegExp(escaped + '([A-Z]+)(\\d+)', 'g'),
          (match, col, rowStr) => {
            const origRow = parseInt(rowStr)
            const newRow = finalRow(origRow)
            return sheetRef + col + newRow
          }
        )
      })
    })
  })

  await wb.xlsx.writeFile(OUTPUT)

  console.log('')
  console.log('Extended template written to:', OUTPUT)
  console.log('')
  console.log(`PMS pump rows: 10-${finalRow(86)} (${finalRow(86) - 10 + 1} rows, was 77)`)
  console.log(`AGO pump rows: ${finalRow(119)}-${finalRow(146) + 28} (${finalRow(146) + 28 - finalRow(119) + 1} rows, was 28)`)
  console.log(`DPK pump rows: ${finalRow(185)}-${finalRow(207) + 23} (${finalRow(207) + 23 - finalRow(185) + 1} rows, was 23)`)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
