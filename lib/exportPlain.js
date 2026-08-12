/**
 * Shared furniture for the plain Excel exports, the ones stations outside the Rainoil group
 * get. Kept out of the bespoke replicas entirely: those are somebody's document and must not
 * start tracking a shared style.
 */

const HEAD_FILL = 'FF0E84D4'  // primary-600, the colour report table headers use on screen
const TOTAL_FILL = 'FFEAF6FE' // primary-50

export function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
  row.alignment = { vertical: 'middle' }
}

export function styleTotal(row) {
  row.font = { bold: true, size: 10 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
}

/** A titled block: title, header row, body rows, optional bold total row. */
export function addBlock(ws, { title, header, rows, total }) {
  if (title) {
    const t = ws.addRow([title])
    t.font = { bold: true, size: 11 }
    ws.addRow([])
  }
  if (header) styleHeader(ws.addRow(header))
  for (const r of rows || []) ws.addRow(r)
  if (total) styleTotal(ws.addRow(total))
  ws.addRow([])
}

/**
 * Widths from the content, because a plain export with everything at the default width is
 * unreadable, and hand-tuned widths drift the moment a column is added.
 */
export function autoWidth(ws, { min = 10, max = 42 } = {}) {
  ws.columns.forEach((col) => {
    let widest = min
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length + 2
      if (len > widest) widest = len
    })
    col.width = Math.min(widest, max)
  })
}

/** Blank rather than NaN, so an empty cell reads as empty instead of as a broken number. */
export const num = (n) => (n == null || Number.isNaN(Number(n)) ? '' : Number(n))

/**
 * Write the workbook out and hand it to the browser.
 *
 * Returns { warnings }, matching the bespoke exports' contract: their pages only read warnings
 * off the result, so a module that returned a buffer instead would produce no file and raise
 * no error either.
 */
export async function downloadWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return { warnings: [] }
}

/** Safe for a filename, and never empty. */
export function safeName(name, fallback = 'Station') {
  return String(name || '').replace(/[^\w\s-]/g, '').trim() || fallback
}
