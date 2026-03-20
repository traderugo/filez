import ExcelJS from 'exceljs'

// ── Colour palette (ARGB, no leading #) ─────────────────────────────────────
const C = {
  HDR_BG:  'FF2563EB',
  HDR_FG:  'FFFFFFFF',
  SUB_BG:  'FFEFF6FF',
  SUB_FG:  'FF2563EB',
  BDR:     'FFBFDBFE',
  BLACK:   'FF000000',
}

const THIN = (argb) => ({ style: 'thin', color: { argb } })
const BORDER = {
  top: THIN(C.BDR), left: THIN(C.BDR), bottom: THIN(C.BDR), right: THIN(C.BDR),
}

function sc(ws, row, col, value, style, align = 'left') {
  const c = ws.getCell(row, col)
  c.value = value ?? ''
  c.border = BORDER
  c.alignment = { horizontal: align, vertical: 'middle', wrapText: false }

  switch (style) {
    case 'hdr':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HDR_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.HDR_FG } }
      break
    case 'subhdr':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.SUB_FG } }
      break
    case 'subtotal':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.BLACK } }
      break
    case 'bold':
      c.font = { bold: true, size: 9, color: { argb: C.BLACK } }
      break
    default:
      c.font = { size: 9, color: { argb: C.BLACK } }
  }
  return c
}

function colLetter(n) {
  let s = ''
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}

/**
 * Export the dip calculator as an Excel workbook matching the PRODUCT RECEIPT template.
 * @param {{ rows: Array<{chartUllage,chartLH,depotUllage,depotLH,stationUllage,stationLH,highVol,lowVol,highUllage,lowUllage}> }} data
 */
export async function exportDipCalcExcel(data) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('PRODUCT RECEIPT CALCULATION')

  // Column widths: A(#) B(label) C-H(data)
  ws.getColumn(1).width = 4
  ws.getColumn(2).width = 8
  for (let i = 3; i <= 8; i++) ws.getColumn(i).width = 14

  const { rows } = data
  let r = 1

  // ── Title ──
  sc(ws, r, 2, 'PRODUCT RECEIPT CALCULATION', 'bold')
  ws.mergeCells(r, 2, r, 8)
  r += 1

  // ── Readings header ──
  sc(ws, r, 1, '', 'hdr')
  sc(ws, r, 2, '', 'hdr')
  sc(ws, r, 3, 'CHART', 'hdr', 'center')
  sc(ws, r, 4, '', 'hdr')
  sc(ws, r, 5, 'DEPOT', 'hdr', 'center')
  sc(ws, r, 6, '', 'hdr')
  sc(ws, r, 7, 'STATION', 'hdr', 'center')
  sc(ws, r, 8, '', 'hdr')
  ws.mergeCells(r, 3, r, 4)
  ws.mergeCells(r, 5, r, 6)
  ws.mergeCells(r, 7, r, 8)
  r++

  sc(ws, r, 1, '#', 'subhdr', 'center')
  sc(ws, r, 2, '', 'subhdr')
  sc(ws, r, 3, 'Ullage', 'subhdr', 'center')
  sc(ws, r, 4, 'Liquid Ht', 'subhdr', 'center')
  sc(ws, r, 5, 'Ullage', 'subhdr', 'center')
  sc(ws, r, 6, 'Liquid Ht', 'subhdr', 'center')
  sc(ws, r, 7, 'Ullage', 'subhdr', 'center')
  sc(ws, r, 8, 'Liquid Ht', 'subhdr', 'center')
  r++

  // Reading rows (r = readingsStart)
  const readingsStart = r
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    sc(ws, r, 1, i + 1, 'body', 'center')
    sc(ws, r, 2, '', 'body')
    sc(ws, r, 3, Number(row.chartUllage) || 0, 'body', 'right')
    sc(ws, r, 4, Number(row.chartLH) || 0, 'body', 'right')
    sc(ws, r, 5, Number(row.depotUllage) || 0, 'body', 'right')
    sc(ws, r, 6, Number(row.depotLH) || 0, 'body', 'right')
    sc(ws, r, 7, Number(row.stationUllage) || 0, 'body', 'right')
    sc(ws, r, 8, Number(row.stationLH) || 0, 'body', 'right')
    r++
  }

  // Spacer
  r++

  // ── Calibration header ──
  sc(ws, r, 1, '#', 'subhdr', 'center')
  sc(ws, r, 2, '', 'subhdr')
  sc(ws, r, 3, 'Highest Vol', 'subhdr', 'center')
  sc(ws, r, 4, 'Lowest Vol', 'subhdr', 'center')
  sc(ws, r, 5, 'Highest Ullage', 'subhdr', 'center')
  sc(ws, r, 6, 'Lowest Ullage', 'subhdr', 'center')
  sc(ws, r, 7, 'Ullage M.F', 'subhdr', 'center')
  sc(ws, r, 8, 'Liquid Ht M.F', 'subhdr', 'center')
  r++

  // Calibration rows with formulas
  const calibStart = r
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rr = readingsStart + i // readings row for this compartment
    sc(ws, r, 1, i + 1, 'body', 'center')
    sc(ws, r, 2, '', 'body')
    sc(ws, r, 3, Number(row.highVol) || 0, 'body', 'right')
    sc(ws, r, 4, Number(row.lowVol) || 0, 'body', 'right')
    sc(ws, r, 5, Number(row.highUllage) || 0, 'body', 'right')
    sc(ws, r, 6, Number(row.lowUllage) || 0, 'body', 'right')
    // Ullage M.F = (HighVol - LowVol) / (HighUllage - LowUllage)
    const mfCell = ws.getCell(r, 7)
    mfCell.value = { formula: `(C${r}-D${r})/(E${r}-F${r})` }
    mfCell.border = BORDER
    mfCell.font = { bold: true, size: 9, color: { argb: C.BLACK } }
    mfCell.alignment = { horizontal: 'right', vertical: 'middle' }
    mfCell.numFmt = '0.00'
    // Liquid Ht M.F = HighVol / ChartLiquidHt
    const lhCell = ws.getCell(r, 8)
    lhCell.value = { formula: `C${r}/D${rr}` }
    lhCell.border = BORDER
    lhCell.font = { bold: true, size: 9, color: { argb: C.BLACK } }
    lhCell.alignment = { horizontal: 'right', vertical: 'middle' }
    lhCell.numFmt = '0.00'
    r++
  }

  // Spacer
  r++

  // ── Ullage-based results ──
  sc(ws, r, 1, '', 'hdr')
  sc(ws, r, 2, '', 'hdr')
  sc(ws, r, 3, 'DEPOT TO STATION', 'hdr', 'center')
  sc(ws, r, 4, '', 'hdr')
  sc(ws, r, 5, 'CHART TO STATION', 'hdr', 'center')
  sc(ws, r, 6, '', 'hdr')
  sc(ws, r, 7, 'CHART TO DEPOT', 'hdr', 'center')
  sc(ws, r, 8, '', 'hdr')
  ws.mergeCells(r, 3, r, 4)
  ws.mergeCells(r, 5, r, 6)
  ws.mergeCells(r, 7, r, 8)
  r++

  sc(ws, r, 1, '#', 'subhdr', 'center')
  sc(ws, r, 2, '', 'subhdr')
  sc(ws, r, 3, 'Ullage Diff', 'subhdr', 'center')
  sc(ws, r, 4, 'Vol', 'subhdr', 'center')
  sc(ws, r, 5, 'Ullage Diff', 'subhdr', 'center')
  sc(ws, r, 6, 'Vol', 'subhdr', 'center')
  sc(ws, r, 7, 'Ullage Diff', 'subhdr', 'center')
  sc(ws, r, 8, 'Vol', 'subhdr', 'center')
  r++

  const ullageResultStart = r
  for (let i = 0; i < rows.length; i++) {
    const rr = readingsStart + i
    const cr = calibStart + i
    sc(ws, r, 1, i + 1, 'body', 'center')
    sc(ws, r, 2, '', 'body')
    // Depot→Station: E(depot) - G(station)
    const setFormula = (col, formula) => {
      const cell = ws.getCell(r, col)
      cell.value = { formula }
      cell.border = BORDER
      cell.font = { size: 9, color: { argb: C.BLACK } }
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      cell.numFmt = '#,##0.0'
    }
    setFormula(3, `E${rr}-G${rr}`)                  // DS ullage diff
    setFormula(4, `C${r}*G${cr}`)                    // DS vol
    setFormula(5, `C${rr}-G${rr}`)                   // CS ullage diff
    setFormula(6, `E${r}*G${cr}`)                    // CS vol
    setFormula(7, `C${rr}-E${rr}`)                   // CD ullage diff
    setFormula(8, `G${r}*G${cr}`)                    // CD vol
    r++
  }

  // Totals
  const ue = r - 1
  sc(ws, r, 1, '', 'subtotal')
  sc(ws, r, 2, 'TOTAL', 'subtotal')
  for (let col = 3; col <= 8; col++) {
    const cell = ws.getCell(r, col)
    cell.value = { formula: `SUM(${colLetter(col)}${ullageResultStart}:${colLetter(col)}${ue})` }
    cell.border = BORDER
    cell.font = { bold: true, size: 9, color: { argb: C.BLACK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    cell.numFmt = '#,##0.0'
  }
  r++

  // Spacer
  r++

  // ── Liquid Height-based results ──
  sc(ws, r, 1, '', 'hdr')
  sc(ws, r, 2, '', 'hdr')
  sc(ws, r, 3, 'DEPOT TO STATION', 'hdr', 'center')
  sc(ws, r, 4, '', 'hdr')
  sc(ws, r, 5, 'CHART TO STATION', 'hdr', 'center')
  sc(ws, r, 6, '', 'hdr')
  sc(ws, r, 7, 'CHART TO DEPOT', 'hdr', 'center')
  sc(ws, r, 8, '', 'hdr')
  ws.mergeCells(r, 3, r, 4)
  ws.mergeCells(r, 5, r, 6)
  ws.mergeCells(r, 7, r, 8)
  r++

  sc(ws, r, 1, '#', 'subhdr', 'center')
  sc(ws, r, 2, '', 'subhdr')
  sc(ws, r, 3, 'Liquid Ht Diff', 'subhdr', 'center')
  sc(ws, r, 4, 'Vol', 'subhdr', 'center')
  sc(ws, r, 5, 'Liquid Ht Diff', 'subhdr', 'center')
  sc(ws, r, 6, 'Vol', 'subhdr', 'center')
  sc(ws, r, 7, 'Liquid Ht Diff', 'subhdr', 'center')
  sc(ws, r, 8, 'Vol', 'subhdr', 'center')
  r++

  const lhResultStart = r
  for (let i = 0; i < rows.length; i++) {
    const rr = readingsStart + i
    const cr = calibStart + i
    sc(ws, r, 1, i + 1, 'body', 'center')
    sc(ws, r, 2, '', 'body')
    const setFormula = (col, formula) => {
      const cell = ws.getCell(r, col)
      cell.value = { formula }
      cell.border = BORDER
      cell.font = { size: 9, color: { argb: C.BLACK } }
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      cell.numFmt = '#,##0.0'
    }
    setFormula(3, `(F${rr}-H${rr})*-1`)              // DS LH diff
    setFormula(4, `C${r}*H${cr}`)                     // DS vol
    setFormula(5, `(D${rr}-H${rr})*-1`)               // CS LH diff
    setFormula(6, `E${r}*H${cr}`)                      // CS vol
    setFormula(7, `(D${rr}-F${rr})*-1`)                // CD LH diff
    setFormula(8, `G${r}*H${cr}`)                      // CD vol
    r++
  }

  // Totals
  const le = r - 1
  sc(ws, r, 1, '', 'subtotal')
  sc(ws, r, 2, 'TOTAL', 'subtotal')
  for (let col = 3; col <= 8; col++) {
    const cell = ws.getCell(r, col)
    cell.value = { formula: `SUM(${colLetter(col)}${lhResultStart}:${colLetter(col)}${le})` }
    cell.border = BORDER
    cell.font = { bold: true, size: 9, color: { argb: C.BLACK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    cell.numFmt = '#,##0.0'
  }

  // Generate and download
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Product Receipt Calculation.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
