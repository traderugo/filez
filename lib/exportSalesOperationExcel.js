/**
 * Export the "Sales Operation" report to .xlsx, matching the Lucky Way Station
 * Daily Sales Report (August 2023) template exactly:
 *
 *   - 11 columns (A–K) per sheet
 *   - One sheet per shift (named DD.MM, DD.MM (2), ...)
 *   - Row layout matches the source template row-for-row
 *   - Excel formulas preserved where the source uses them (cached result included)
 *
 * Stubbed sections in v1 (rendered blank):
 *   - Opening/Closing time header (R2)
 *   - Sales Achievement vs Budget (R27–R31)
 *   - Competitor Prices (R33–R36)
 *
 * @param {Object} params
 * @param {Object} params.report      - Output of buildSalesOperationReport
 * @param {string} params.stationName - Station name for header
 * @param {string} params.startDate   - YYYY-MM-DD
 * @param {string} params.endDate     - YYYY-MM-DD
 */

import ExcelJS from 'exceljs'

const C = {
  HDR_BG:  'FF2563EB',
  HDR_FG:  'FFFFFFFF',
  SUB_BG:  'FFEFF6FF',
  SUB_FG:  'FF2563EB',
  BDR:     'FFBFDBFE',
  BLACK:   'FF000000',
}

const THIN = (argb) => ({ style: 'thin', color: { argb } })
const BORDER = { top: THIN(C.BDR), left: THIN(C.BDR), bottom: THIN(C.BDR), right: THIN(C.BDR) }

// 11 columns
const WIDTHS = [20, 12, 14, 11, 11, 12, 14, 11, 11, 14, 14]

function setColWidths(ws) {
  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.properties.defaultRowHeight = 15
}

function fmtN(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n)
}

// Styled cell writer
function sc(ws, row, col, value, style, align = 'left') {
  const c = ws.getCell(row, col)
  c.value = value == null ? '' : value
  c.border = BORDER
  c.alignment = { horizontal: align, vertical: 'middle', wrapText: false }
  switch (style) {
    case 'hdr':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HDR_BG } }
      c.font = { bold: true, size: 10, color: { argb: C.HDR_FG } }
      break
    case 'subhdr':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.SUB_FG } }
      break
    case 'bold':
      c.font = { bold: true, size: 9, color: { argb: C.BLACK } }
      break
    default:
      c.font = { size: 9, color: { argb: C.BLACK } }
  }
  return c
}

function fillRange(ws, row, c1, c2, style) {
  for (let c = c1; c <= c2; c++) sc(ws, row, c, '', style)
}

function setFormula(ws, row, col, formula, result, align = 'right') {
  const c = ws.getCell(row, col)
  c.value = { formula, result }
  c.border = BORDER
  c.alignment = { horizontal: align, vertical: 'middle' }
  c.font = { size: 9, color: { argb: C.BLACK } }
  return c
}

function isoToTemplateDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d
}

// Build a single sheet for one "shift"
function buildSheet(ws, sheet, fuelTypes, stationName) {
  setColWidths(ws)

  const FUEL_ROWS = { PMS: 5, AGO: 6, DPK: 7 }
  const LUBES_ROW = 8
  const STOCK_ROWS = { PMS: 11, AGO: 12, DPK: 13 }
  const RECON_ROWS = { PMS: 16, AGO: 17, DPK: 18 }
  const BUDGET_ROWS = { PMS: 28, AGO: 29, DPK: 30 }
  const COMP_ROWS = { PMS: 34, AGO: 35, DPK: 36 }

  // ── R1: Station header (merged B:K) ──
  sc(ws, 1, 1, '', 'bold')
  sc(ws, 1, 2, 'Station', 'bold', 'left')
  for (let c = 3; c <= 11; c++) sc(ws, 1, c, '', 'bold')
  sc(ws, 1, 3, stationName || '', 'bold', 'center')
  ws.mergeCells(1, 3, 1, 11)

  // ── R2: Date + Opening/Closing time ──
  sc(ws, 2, 1, '', 'bold')
  sc(ws, 2, 2, 'Date', 'bold', 'left')
  // Date in C:E (merged), Opening Time label in F, time in G:H (merged), Closing Time label in I, time in J:K (merged)
  const dateObj = isoToTemplateDate(sheet.date)
  const cellDate = ws.getCell(2, 3)
  cellDate.value = dateObj
  cellDate.numFmt = 'yyyy-mm-dd'
  cellDate.border = BORDER
  cellDate.alignment = { horizontal: 'center', vertical: 'middle' }
  cellDate.font = { size: 9, color: { argb: C.BLACK } }
  for (let c = 4; c <= 5; c++) sc(ws, 2, c, '', 'body', 'center')
  ws.mergeCells(2, 3, 2, 5)

  sc(ws, 2, 6, 'Opening Time', 'bold', 'left')
  sc(ws, 2, 7, sheet.times?.opening || '', 'body', 'center')
  sc(ws, 2, 8, '', 'body')
  ws.mergeCells(2, 7, 2, 8)

  sc(ws, 2, 9, 'Closing Time', 'bold', 'left')
  sc(ws, 2, 10, sheet.times?.closing || '', 'body', 'center')
  sc(ws, 2, 11, '', 'body')
  ws.mergeCells(2, 10, 2, 11)

  // ── R3: blank ──
  for (let c = 1; c <= 11; c++) sc(ws, 3, c, '', 'body')

  // ── R4: Fuel sales headers ──
  sc(ws, 4, 1, '', 'subhdr')
  sc(ws, 4, 2, 'Price 1', 'subhdr', 'center')
  sc(ws, 4, 3, 'Actual Sales @P1', 'subhdr', 'center')
  sc(ws, 4, 4, 'RTT @P1', 'subhdr', 'center')
  sc(ws, 4, 5, 'Cons. @P1', 'subhdr', 'center')
  sc(ws, 4, 6, 'Price 2', 'subhdr', 'center')
  sc(ws, 4, 7, 'Actual Sales @P2', 'subhdr', 'center')
  sc(ws, 4, 8, 'RTT @P2', 'subhdr', 'center')
  sc(ws, 4, 9, 'Cons. @P2', 'subhdr', 'center')
  sc(ws, 4, 10, 'Total Actual Sales (Ltrs)', 'subhdr', 'center')
  sc(ws, 4, 11, 'Amount (N)', 'subhdr', 'center')

  // ── R5-R7: PMS, AGO, DPK fuel rows ──
  const fuelByType = {}
  for (const f of sheet.fuel) fuelByType[f.fuelType] = f

  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = FUEL_ROWS[ft]
    const f = fuelByType[ft] || { price1: 0, actualSalesP1: 0, rttP1: 0, consP1: 0, price2: 0, actualSalesP2: 0, rttP2: 0, consP2: 0, totalActualLtrs: 0, amount: 0 }
    sc(ws, row, 1, ft, 'bold', 'left')
    sc(ws, row, 2, fmtN(f.price1), 'body', 'right')
    sc(ws, row, 3, fmtN(f.actualSalesP1), 'body', 'right')
    sc(ws, row, 4, fmtN(f.rttP1), 'body', 'right')
    sc(ws, row, 5, fmtN(f.consP1), 'body', 'right')
    sc(ws, row, 6, fmtN(f.price2), 'body', 'right')
    sc(ws, row, 7, fmtN(f.actualSalesP2), 'body', 'right')
    sc(ws, row, 8, fmtN(f.rttP2), 'body', 'right')
    sc(ws, row, 9, fmtN(f.consP2), 'body', 'right')
    setFormula(ws, row, 10, `C${row}+G${row}`, f.totalActualLtrs)
    setFormula(ws, row, 11, `(B${row}*C${row})+(F${row}*G${row})`, f.amount)
  }

  // ── R8: LUBES row (amount refs lube total) ──
  sc(ws, LUBES_ROW, 1, 'LUBES', 'bold', 'left')
  for (let c = 2; c <= 9; c++) sc(ws, LUBES_ROW, c, '', 'body', 'right')
  sc(ws, LUBES_ROW, 10, '', 'body', 'right')
  // K8 = lube total amount. Computed below after we know lube total row.
  // Placeholder; overwritten below.
  sc(ws, LUBES_ROW, 11, '', 'body', 'right')

  // ── R9: STOCK INVENTORY section header (merged) ──
  sc(ws, 9, 1, 'STOCK INVENTORY (LITRES)', 'subhdr', 'center')
  fillRange(ws, 9, 2, 11, 'subhdr')
  ws.mergeCells(9, 1, 9, 11)

  // ── R10: stock headers ──
  sc(ws, 10, 1, '', 'subhdr')
  sc(ws, 10, 2, 'Opening stock', 'subhdr', 'center')
  sc(ws, 10, 3, 'Waybill Qty Supplied', 'subhdr', 'center')
  sc(ws, 10, 4, 'Actual Qty Received', 'subhdr', 'center')
  sc(ws, 10, 5, 'Truck Shortage', 'subhdr', 'center')
  sc(ws, 10, 6, 'Total Dispensed', 'subhdr', 'center')
  sc(ws, 10, 7, 'Closing stock', 'subhdr', 'center')
  for (let c = 8; c <= 11; c++) sc(ws, 10, c, '', 'subhdr')

  // ── R11-R13: stock rows ──
  const stockByType = {}
  for (const s of sheet.stock) stockByType[s.fuelType] = s

  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = STOCK_ROWS[ft]
    const fuelRow = FUEL_ROWS[ft]
    const s = stockByType[ft] || { opening: 0, waybill: 0, actualReceived: 0, totalDispensed: 0, closing: 0 }
    sc(ws, row, 1, ft, 'bold', 'left')
    sc(ws, row, 2, fmtN(s.opening), 'body', 'right')
    sc(ws, row, 3, fmtN(s.waybill), 'body', 'right')
    sc(ws, row, 4, fmtN(s.actualReceived), 'body', 'right')
    setFormula(ws, row, 5, `D${row}-C${row}`, (s.actualReceived || 0) - (s.waybill || 0))
    setFormula(
      ws, row, 6,
      `C${fuelRow}+D${fuelRow}+E${fuelRow}+G${fuelRow}+H${fuelRow}+I${fuelRow}`,
      s.totalDispensed
    )
    sc(ws, row, 7, fmtN(s.closing), 'body', 'right')
    for (let c = 8; c <= 11; c++) sc(ws, row, c, '', 'body')
  }

  // ── R14: STOCK RECONCILIATION header ──
  sc(ws, 14, 1, 'STOCK RECONCILIATION (Litres)', 'subhdr', 'center')
  fillRange(ws, 14, 2, 11, 'subhdr')
  ws.mergeCells(14, 1, 14, 11)

  // ── R15: recon headers ──
  sc(ws, 15, 1, '', 'subhdr')
  sc(ws, 15, 2, 'Expected Overage', 'subhdr', 'center')
  sc(ws, 15, 3, 'Actual Overage', 'subhdr', 'center')
  sc(ws, 15, 4, 'Variance', 'subhdr', 'center')
  for (let c = 5; c <= 11; c++) sc(ws, 15, c, '', 'subhdr')

  // ── R16-R18: recon rows ──
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = RECON_ROWS[ft]
    const stockRow = STOCK_ROWS[ft]
    const fuelRow = FUEL_ROWS[ft]
    const s = stockByType[ft] || { opening: 0, waybill: 0, closing: 0 }
    const f = fuelByType[ft] || { rttP1: 0, rttP2: 0 }
    const expectedOverage = (s.opening + s.waybill - s.closing) * 0.01
    // actualOverage formula: =F11-(B11+C11-G11)-(D5+H5)
    // = totalDispensed - (opening + waybill - closing) - (rttP1 + rttP2)
    const totalDispensed = s.totalDispensed || 0
    const actualOverage = totalDispensed - (s.opening + s.waybill - s.closing) - ((f.rttP1 || 0) + (f.rttP2 || 0))
    const variance = actualOverage - expectedOverage

    sc(ws, row, 1, ft, 'bold', 'left')
    setFormula(ws, row, 2, `(B${stockRow}+C${stockRow}-G${stockRow})*0.01`, expectedOverage)
    setFormula(ws, row, 3, `F${stockRow}-(B${stockRow}+C${stockRow}-G${stockRow})-(D${fuelRow}+H${fuelRow})`, actualOverage)
    setFormula(ws, row, 4, `C${row}-B${row}`, variance)
    for (let c = 5; c <= 11; c++) {
      setFormula(ws, row, c, `IF(D${row}>0, "Liquid height variance", "")`, variance > 0 ? 'Liquid height variance' : '')
    }
  }

  // ── R19: blank separator ──
  for (let c = 1; c <= 11; c++) sc(ws, 19, c, '', 'body')

  // ── R20: deposit + POS headers ──
  sc(ws, 20, 1, '', 'subhdr')
  sc(ws, 20, 2, 'Deposit 1', 'subhdr', 'center')
  sc(ws, 20, 3, 'Deposit 2', 'subhdr', 'center')
  sc(ws, 20, 4, 'Deposit 3', 'subhdr', 'center')
  sc(ws, 20, 5, 'Deposit 4', 'subhdr', 'center')
  sc(ws, 20, 6, 'Bank POS 1', 'subhdr', 'center')
  sc(ws, 20, 7, 'Bank POS 2', 'subhdr', 'center')
  sc(ws, 20, 8, 'Bank POS 3', 'subhdr', 'center')
  sc(ws, 20, 9, 'Bank POS 4', 'subhdr', 'center')
  sc(ws, 20, 10, 'Bank POS 5', 'subhdr', 'center')
  sc(ws, 20, 11, 'Bank POS 6', 'subhdr', 'center')

  // ── R21: amounts ──
  const deposits = sheet.bankRows.deposits
  const pos = sheet.bankRows.pos
  sc(ws, 21, 1, 'Amount (₦)', 'bold', 'left')
  for (let i = 0; i < 4; i++) {
    sc(ws, 21, 2 + i, deposits[i] ? fmtN(deposits[i].amount) : '', 'body', 'right')
  }
  for (let i = 0; i < 6; i++) {
    sc(ws, 21, 6 + i, pos[i] ? fmtN(pos[i].amount) : '', 'body', 'right')
  }

  // ── R22: bank names ──
  sc(ws, 22, 1, 'Bank', 'bold', 'left')
  for (let i = 0; i < 4; i++) {
    sc(ws, 22, 2 + i, deposits[i]?.bankName || '', 'body', 'center')
  }
  for (let i = 0; i < 6; i++) {
    sc(ws, 22, 6 + i, pos[i]?.bankName || '', 'body', 'center')
  }

  // ── R23: CASH RECON header ──
  sc(ws, 23, 1, 'CASH RECONCILIATION (₦)', 'subhdr', 'center')
  fillRange(ws, 23, 2, 11, 'subhdr')
  ws.mergeCells(23, 1, 23, 11)

  // ── R24: cash recon headers ──
  sc(ws, 24, 1, '', 'subhdr')
  sc(ws, 24, 2, 'Total Expected Sales', 'subhdr', 'center')
  sc(ws, 24, 3, 'Previous Day Cash @ Hand', 'subhdr', 'center')
  sc(ws, 24, 4, 'Total Bank Deposit', 'subhdr', 'center')
  sc(ws, 24, 5, 'Total POS', 'subhdr', 'center')
  sc(ws, 24, 6, 'Expected Cash @ Hand', 'subhdr', 'center')
  sc(ws, 24, 7, 'Actual Cash @ Hand', 'subhdr', 'center')
  sc(ws, 24, 8, 'Variance in Cash', 'subhdr', 'center')
  sc(ws, 24, 9, 'Reason for Cash Variance', 'subhdr', 'center')
  for (let c = 10; c <= 11; c++) sc(ws, 24, c, '', 'subhdr')
  ws.mergeCells(24, 9, 24, 11)

  // ── R25: cash recon values ──
  const cash = sheet.cash
  sc(ws, 25, 1, 'Amount (₦)', 'bold', 'left')
  setFormula(ws, 25, 2, `SUM(K5:K8)`, cash.totalExpectedSales)
  sc(ws, 25, 3, fmtN(cash.prevDayCash), 'body', 'right')
  setFormula(ws, 25, 4, `B21+C21+D21+E21`, cash.totalBankDeposit)
  setFormula(ws, 25, 5, `SUM(F21:K21)`, cash.totalPOS)
  setFormula(ws, 25, 6, `B25+C25-D25-E25`, cash.expectedCashAtHand)
  sc(ws, 25, 7, fmtN(cash.actualCashAtHand), 'body', 'right')
  setFormula(ws, 25, 8, `G25-F25`, cash.variance)
  sc(ws, 25, 9, cash.reason || '', 'body', 'left')
  sc(ws, 25, 10, '', 'body')
  sc(ws, 25, 11, '', 'body')
  ws.mergeCells(25, 9, 25, 11)

  // ── R26: blank ──
  for (let c = 1; c <= 11; c++) sc(ws, 26, c, '', 'body')

  // ── R27: budget headers ──
  sc(ws, 27, 1, '', 'subhdr')
  sc(ws, 27, 2, 'Budget (Ltrs)', 'subhdr', 'center')
  sc(ws, 27, 3, 'Achievement', 'subhdr', 'center')
  sc(ws, 27, 4, 'Variance (Ltrs)', 'subhdr', 'center')
  sc(ws, 27, 5, 'Comments on Sales Achievement', 'subhdr', 'center')
  for (let c = 6; c <= 11; c++) sc(ws, 27, c, '', 'subhdr')
  ws.mergeCells(27, 5, 27, 11)

  // ── R28-R30: budget rows (STUBBED) ──
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = BUDGET_ROWS[ft]
    sc(ws, row, 1, ft, 'bold', 'left')
    sc(ws, row, 2, '', 'body', 'right')
    sc(ws, row, 3, '', 'body', 'right')
    sc(ws, row, 4, '', 'body', 'right')
    for (let c = 5; c <= 11; c++) sc(ws, row, c, '', 'body')
    ws.mergeCells(row, 5, row, 11)
  }

  // ── R31: LUBES budget row (STUBBED) ──
  sc(ws, 31, 1, 'LUBES', 'bold', 'left')
  sc(ws, 31, 2, 0, 'body', 'right')
  sc(ws, 31, 3, 0, 'body', 'right')
  sc(ws, 31, 4, 0, 'body', 'right')
  for (let c = 5; c <= 11; c++) sc(ws, 31, c, '', 'body')
  ws.mergeCells(31, 5, 31, 11)

  // ── R32: blank separator ──
  for (let c = 1; c <= 11; c++) sc(ws, 32, c, '', 'body')

  // ── R33: competitor headers ──
  sc(ws, 33, 1, '', 'subhdr')
  sc(ws, 33, 2, 'Rainoil', 'subhdr', 'center')
  sc(ws, 33, 3, 'Competitor 1', 'subhdr', 'center')
  sc(ws, 33, 4, 'Price 1', 'subhdr', 'center')
  sc(ws, 33, 5, 'Competitor 2', 'subhdr', 'center')
  sc(ws, 33, 6, 'Price 2', 'subhdr', 'center')
  sc(ws, 33, 7, 'Competitor 3', 'subhdr', 'center')
  sc(ws, 33, 8, 'Price 3', 'subhdr', 'center')
  sc(ws, 33, 9, 'Competitor 4', 'subhdr', 'center')
  sc(ws, 33, 10, 'Price 4', 'subhdr', 'center')
  sc(ws, 33, 11, '', 'subhdr')

  // ── R34-R36: competitor rows (STUBBED) ──
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = COMP_ROWS[ft]
    sc(ws, row, 1, ft, 'bold', 'left')
    for (let c = 2; c <= 11; c++) sc(ws, row, c, '', 'body', 'center')
  }

  // ── R37: LUBE BREAKDOWN header ──
  sc(ws, 37, 1, 'LUBE SALES BREAKDOWN', 'subhdr', 'center')
  fillRange(ws, 37, 2, 11, 'subhdr')
  ws.mergeCells(37, 1, 37, 11)

  // ── R38: lube headers ──
  sc(ws, 38, 1, '', 'subhdr')
  sc(ws, 38, 2, '', 'subhdr')
  sc(ws, 38, 3, 'Litre', 'subhdr', 'center')
  sc(ws, 38, 4, 'Unit Price', 'subhdr', 'center')
  sc(ws, 38, 5, 'Opening Stock Units', 'subhdr', 'center')
  sc(ws, 38, 6, 'Product Supply Units', 'subhdr', 'center')
  sc(ws, 38, 7, 'Sales Units', 'subhdr', 'center')
  sc(ws, 38, 8, 'Closing Stock Units', 'subhdr', 'center')
  sc(ws, 38, 9, 'Amount (₦)', 'subhdr', 'center')
  sc(ws, 38, 10, 'Variance Units', 'subhdr', 'center')
  sc(ws, 38, 11, '', 'subhdr')

  // ── R39+: lube product rows ──
  const firstLubeRow = 39
  const lubeItems = sheet.lube || []
  let row = firstLubeRow
  for (const item of lubeItems) {
    sc(ws, row, 1, item.productName, 'bold', 'left')
    sc(ws, row, 2, item.productName, 'bold', 'left')
    sc(ws, row, 3, fmtN(item.litre), 'body', 'right')
    sc(ws, row, 4, fmtN(item.unitPrice), 'body', 'right')
    sc(ws, row, 5, fmtN(item.openingStock), 'body', 'right')
    sc(ws, row, 6, fmtN(item.productSupply), 'body', 'right')
    setFormula(ws, row, 7, `E${row}+F${row}-H${row}`, item.sales)
    sc(ws, row, 8, fmtN(item.closingStock), 'body', 'right')
    setFormula(ws, row, 9, `G${row}*D${row}`, item.amount)
    setFormula(ws, row, 10, `G${row}+H${row}-E${row}-F${row}`, item.variance)
    sc(ws, row, 11, '', 'body')
    row++
  }

  // TOTAL row
  const totalRow = lubeItems.length > 0 ? row : firstLubeRow
  if (lubeItems.length > 0) {
    sc(ws, totalRow, 1, 'TOTAL', 'subhdr', 'left')
    sc(ws, totalRow, 2, 'TOTAL', 'subhdr', 'left')
    sc(ws, totalRow, 3, '', 'subhdr')
    sc(ws, totalRow, 4, '', 'subhdr')
    const lastRow = totalRow - 1
    const sumOpening = lubeItems.reduce((s, i) => s + (i.openingStock || 0), 0)
    const sumSupply = lubeItems.reduce((s, i) => s + (i.productSupply || 0), 0)
    const sumSales = lubeItems.reduce((s, i) => s + (i.sales || 0), 0)
    const sumClosing = lubeItems.reduce((s, i) => s + (i.closingStock || 0), 0)
    const sumAmount = lubeItems.reduce((s, i) => s + (i.amount || 0), 0)
    const sumVariance = lubeItems.reduce((s, i) => s + (i.variance || 0), 0)
    setFormula(ws, totalRow, 5, `SUM(E${firstLubeRow}:E${lastRow})`, sumOpening)
    setFormula(ws, totalRow, 6, `SUM(F${firstLubeRow}:F${lastRow})`, sumSupply)
    setFormula(ws, totalRow, 7, `SUM(G${firstLubeRow}:G${lastRow})`, sumSales)
    setFormula(ws, totalRow, 8, `SUM(H${firstLubeRow}:H${lastRow})`, sumClosing)
    setFormula(ws, totalRow, 9, `SUM(I${firstLubeRow}:I${lastRow})`, sumAmount)
    setFormula(ws, totalRow, 10, `SUM(J${firstLubeRow}:J${lastRow})`, sumVariance)
    sc(ws, totalRow, 11, '', 'subhdr')

    // Now wire R8 LUBES amount K8 to point at I<totalRow>
    setFormula(ws, LUBES_ROW, 11, `I${totalRow}`, sumAmount)
  } else {
    // No lube items — leave K8 blank
    sc(ws, LUBES_ROW, 11, '', 'body', 'right')
  }
}

// Make Excel-safe sheet name
function safeSheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, '_').slice(0, 31)
}

// Build filename from station + range
function buildFilename(stationName, startDate, endDate) {
  const station = (stationName || 'Station').replace(/[\\/?*[\]:]/g, '').trim()
  return `${station} Sales Operation ${startDate} to ${endDate}.xlsx`
}

// Trigger browser download
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportSalesOperationExcel({ report, stationName, startDate, endDate }) {
  if (!report || !report.sheets?.length) return

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Station Portal'
  wb.created = new Date()

  for (const sheet of report.sheets) {
    const ws = wb.addWorksheet(safeSheetName(sheet.sheetName))
    buildSheet(ws, sheet, report.fuelTypes, stationName)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, buildFilename(stationName, startDate, endDate))
}
