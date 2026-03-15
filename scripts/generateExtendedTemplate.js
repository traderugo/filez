/**
 * One-time script to generate an extended audit report template
 * with double the pump rows for each fuel type in Sheet 2.
 *
 * Run: node scripts/generateExtendedTemplate.js
 *
 * PMS: 77 → 154 pump rows
 * AGO: 28 → 56 pump rows
 * DPK: 23 → 46 pump rows
 */
const XLSX = require('xlsx')
const path = require('path')

const INPUT = path.join(__dirname, '..', 'public', 'templates', 'AUDIT REPORT TEMPLATE.xlsx')
const OUTPUT = path.join(__dirname, '..', 'public', 'templates', 'AUDIT REPORT TEMPLATE (EXTENDED).xlsx')

const wb = XLSX.readFile(INPUT, { cellStyles: true, cellFormula: true })
const SHEET = '2. Sales>>Cash Position'
const ws = wb.Sheets[SHEET]

// ── Insertion config (1-indexed, original coordinates) ──────────
// PMS: pump rows 10-86. Insert 77 after row 85 so that row 86 shifts
//       and the SUM ref SUM(E10:E86) auto-expands to SUM(E10:E163).
// AGO: pump rows 119-146. SUM is SUM(E119:E147) — row 147 (empty) is
//       inside the range, so inserting after 146 makes 147 shift correctly.
// DPK: pump rows 185-207. SUM is SUM(E185:E208) — same pattern as AGO.
const PMS_AFTER = 85, PMS_COUNT = 77
const AGO_AFTER = 146, AGO_COUNT = 28
const DPK_AFTER = 207, DPK_COUNT = 23

/** Compute final 1-indexed row from original 1-indexed row */
function finalRow(r) {
  let result = r
  if (r > PMS_AFTER) result += PMS_COUNT
  if (r > AGO_AFTER) result += AGO_COUNT
  if (r > DPK_AFTER) result += DPK_COUNT
  return result
}

/** Shift row references in a formula, skipping cross-sheet refs */
function shiftFormula(formula) {
  return formula.replace(/([A-Z]+)(\d+)/g, (match, col, rowStr, offset) => {
    if (offset > 0 && formula[offset - 1] === '!') return match
    const row = parseInt(rowStr)
    const newRow = finalRow(row)
    return newRow !== row ? col + newRow : match
  })
}

// ── Step 1: Collect all cells ───────────────────────────────────
const range = XLSX.utils.decode_range(ws['!ref'])
const cells = []
for (let r = range.s.r; r <= range.e.r; r++) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c })
    if (ws[addr]) {
      cells.push({ r, c, cell: { ...ws[addr] } })
      delete ws[addr]
    }
  }
}

// ── Step 2: Re-add cells at shifted positions ───────────────────
for (const { r, c, cell } of cells) {
  const origRow1 = r + 1
  const newRow1 = finalRow(origRow1)
  const newR = newRow1 - 1
  const newAddr = XLSX.utils.encode_cell({ r: newR, c })

  if (cell.f) {
    cell.f = shiftFormula(cell.f)
  }

  ws[newAddr] = cell
}

// ── Step 3: Add pump formulas in new gap rows ───────────────────
function addPumpFormulas(gapStart1, gapEnd1) {
  for (let row1 = gapStart1; row1 <= gapEnd1; row1++) {
    const r = row1 - 1
    // E = D - C (dispensed)
    ws[XLSX.utils.encode_cell({ r, c: 4 })] = { f: `D${row1}-C${row1}`, t: 'n' }
    // G = E * F (amount)
    ws[XLSX.utils.encode_cell({ r, c: 6 })] = { f: `E${row1}*F${row1}`, t: 'n' }
  }
}

// PMS gap: rows 86-162 (1-indexed)
addPumpFormulas(PMS_AFTER + 1, PMS_AFTER + PMS_COUNT)

// AGO gap: between finalRow(146)=223 and finalRow(147)=252 → rows 224-251
const agoGapStart = finalRow(AGO_AFTER) + 1
const agoGapEnd = finalRow(AGO_AFTER + 1) - 1
addPumpFormulas(agoGapStart, agoGapEnd)

// DPK gap: between finalRow(207)=312 and finalRow(208)=336 → rows 313-335
const dpkGapStart = finalRow(DPK_AFTER) + 1
const dpkGapEnd = finalRow(DPK_AFTER + 1) - 1
addPumpFormulas(dpkGapStart, dpkGapEnd)

// ── Step 4: Shift row heights ───────────────────────────────────
if (ws['!rows']) {
  const oldRows = [...ws['!rows']]
  ws['!rows'] = []
  for (let i = 0; i < oldRows.length; i++) {
    if (oldRows[i]) {
      const origRow1 = i + 1
      const newRow1 = finalRow(origRow1)
      const newIdx = newRow1 - 1
      ws['!rows'][newIdx] = oldRows[i]
    }
  }
}

// ── Step 5: Shift merged ranges ─────────────────────────────────
if (ws['!merges']) {
  ws['!merges'] = ws['!merges'].map(m => ({
    s: { r: finalRow(m.s.r + 1) - 1, c: m.s.c },
    e: { r: finalRow(m.e.r + 1) - 1, c: m.e.c },
  }))
}

// ── Step 6: Update sheet range ──────────────────────────────────
const maxOrigRow1 = range.e.r + 1
const newMaxRow1 = finalRow(maxOrigRow1)
ws['!ref'] = XLSX.utils.encode_range({
  s: { r: range.s.r, c: range.s.c },
  e: { r: newMaxRow1 - 1, c: range.e.c },
})

// ── Step 7: Fix cross-sheet references TO Sheet 2 from other sheets ──
const SHEET_2_REF = "'2. Sales>>Cash Position'!"
for (const name of wb.SheetNames) {
  if (name === SHEET) continue
  const other = wb.Sheets[name]
  if (!other || !other['!ref']) continue
  const oRange = XLSX.utils.decode_range(other['!ref'])
  for (let r = oRange.s.r; r <= oRange.e.r; r++) {
    for (let c = oRange.s.c; c <= oRange.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = other[addr]
      if (!cell || !cell.f || !cell.f.includes(SHEET_2_REF)) continue
      // Shift row references that come after the Sheet 2 reference prefix
      cell.f = cell.f.replace(
        new RegExp(SHEET_2_REF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([A-Z]+)(\\d+)', 'g'),
        (match, col, rowStr) => {
          const row = parseInt(rowStr)
          return SHEET_2_REF + col + finalRow(row)
        }
      )
    }
  }
}

// ── Step 8: Write ───────────────────────────────────────────────
XLSX.writeFile(wb, OUTPUT)

console.log('Extended template written to:', OUTPUT)
console.log('')
console.log('PMS pump rows: 10-' + finalRow(86) + ' (' + (finalRow(86) - 10 + 1) + ' rows, was 77)')
console.log('AGO pump rows: ' + finalRow(119) + '-' + agoGapEnd + ' (' + (agoGapEnd - finalRow(119) + 1) + ' rows, was 28)')
console.log('DPK pump rows: ' + finalRow(185) + '-' + dpkGapEnd + ' (' + (dpkGapEnd - finalRow(185) + 1) + ' rows, was 23)')
