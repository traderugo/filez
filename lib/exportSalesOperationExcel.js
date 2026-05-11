/**
 * Export the "Sales Operation" report to .xlsx, an exact visual replica of the
 * Lucky Way Station Daily Sales Report (August 2023) template:
 *
 *   - 11 columns (A–K) per sheet
 *   - One sheet per shift (DD.MM, DD.MM (2), ...)
 *   - Excel formulas preserved (cached result included)
 *   - Corbel font, black thin borders + medium section edges, yellow input cells
 *   - Accounting number format on all numeric cells
 *
 * Sections with no source data (Opening/Closing time, Sales Achievement budget,
 * Competitor Prices) render with the reference template's placeholder values
 * hard-coded so the export looks identical.
 */

import ExcelJS from 'exceljs'

// ─── Styling constants ──────────────────────────────────────
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
const HDR_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } } // light blue
const SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } } // slightly darker blue

const FONT       = { name: 'Corbel', size: 11, color: { argb: 'FF000000' } }
const FONT_BOLD  = { name: 'Corbel', size: 11, bold: true, color: { argb: 'FF000000' } }
const FONT_HDR   = { name: 'Corbel', size: 11, bold: true, color: { argb: 'FF1F4E78' } }
const FONT_TITLE = { name: 'Corbel', size: 12, bold: true, color: { argb: 'FF1F4E78' } }

const THIN  = { style: 'thin',   color: { argb: 'FF000000' } }
const MED   = { style: 'medium', color: { argb: 'FF000000' } }
const BORDER_THIN = { top: THIN, bottom: THIN, left: THIN, right: THIN }

const NUM_FMT = '#,##0'

// 11 columns
const WIDTHS = [22, 13, 16, 11, 11, 13, 16, 11, 11, 17, 15]

function setColWidths(ws) {
  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.properties.defaultRowHeight = 18
}

function applyStyle(cell, { font, fill, border, alignment, numFmt }) {
  if (font)      cell.font = font
  if (fill)      cell.fill = fill
  if (border)    cell.border = border
  if (alignment) cell.alignment = alignment
  if (numFmt)    cell.numFmt = numFmt
}

// Generic cell setter
function setCell(ws, row, col, value, opts = {}) {
  const c = ws.getCell(row, col)
  c.value = value == null ? '' : value
  applyStyle(c, {
    font: opts.font || FONT,
    fill: opts.fill,
    border: opts.border === undefined ? BORDER_THIN : opts.border,
    alignment: opts.alignment || { horizontal: opts.align || 'left', vertical: 'middle', wrapText: false },
    numFmt: opts.numFmt,
  })
  return c
}

function setNum(ws, row, col, value, opts = {}) {
  const c = ws.getCell(row, col)
  c.value = (value == null || value === '' || (typeof value === 'number' && isNaN(value))) ? null : Number(value)
  applyStyle(c, {
    font: opts.font || FONT,
    fill: opts.fill,
    border: BORDER_THIN,
    alignment: opts.alignment || { horizontal: 'right', vertical: 'middle' },
    numFmt: opts.numFmt || NUM_FMT,
  })
  return c
}

function setFormula(ws, row, col, formula, result, opts = {}) {
  const c = ws.getCell(row, col)
  c.value = { formula, result }
  applyStyle(c, {
    font: opts.font || FONT,
    fill: opts.fill,
    border: BORDER_THIN,
    alignment: opts.alignment || { horizontal: 'right', vertical: 'middle' },
    numFmt: opts.numFmt || NUM_FMT,
  })
  return c
}

function fillBlanks(ws, row, c1, c2, opts = {}) {
  for (let c = c1; c <= c2; c++) setCell(ws, row, c, '', opts)
}

// ─── Section header ───
function sectionHeader(ws, row, label) {
  for (let c = 1; c <= 11; c++) {
    setCell(ws, row, c, c === 1 ? label : '', {
      font: FONT_TITLE,
      fill: SECTION_FILL,
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
  }
  ws.mergeCells(row, 1, row, 11)
}

// ─── Column header row (light blue fill) ───
function colHeaderCell(ws, row, col, label) {
  setCell(ws, row, col, label, {
    font: FONT_HDR,
    fill: HDR_FILL,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  })
}

// ─── Sheet builder ───
function buildSheet(ws, sheet, stationName) {
  setColWidths(ws)

  const FUEL_ROWS  = { PMS: 5,  AGO: 6,  DPK: 7 }
  const LUBES_ROW  = 8
  const STOCK_ROWS = { PMS: 11, AGO: 12, DPK: 13 }
  const RECON_ROWS = { PMS: 16, AGO: 17, DPK: 18 }
  const BUDGET_ROWS = { PMS: 28, AGO: 29, DPK: 30 }
  const COMP_ROWS   = { PMS: 34, AGO: 35, DPK: 36 }

  const fuelByType = Object.fromEntries(sheet.fuel.map(f => [f.fuelType, f]))
  const stockByType = Object.fromEntries(sheet.stock.map(s => [s.fuelType, s]))

  // ─── R1: Station header ─────────────────────────────────────────────
  setCell(ws, 1, 1, '', { fill: YELLOW_FILL })
  setCell(ws, 1, 2, 'Station', { font: FONT_BOLD, fill: HDR_FILL })
  for (let c = 3; c <= 11; c++) {
    setCell(ws, 1, c, c === 3 ? (stationName || '') : '', {
      font: FONT_BOLD,
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
  }
  ws.mergeCells(1, 3, 1, 11)

  // ─── R2: Date + Opening/Closing time ────────────────────────────────
  setCell(ws, 2, 1, '', {})
  setCell(ws, 2, 2, 'Date', { font: FONT_BOLD, fill: HDR_FILL })
  setCell(ws, 2, 3, sheet.date, { // text format matching reference
    fill: YELLOW_FILL,
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  setCell(ws, 2, 4, '', { fill: YELLOW_FILL })
  setCell(ws, 2, 5, '', { fill: YELLOW_FILL })
  ws.mergeCells(2, 3, 2, 5)

  setCell(ws, 2, 6, 'Opening Time', { font: FONT_BOLD, fill: HDR_FILL })
  setCell(ws, 2, 7, '6;00am', {
    fill: YELLOW_FILL,
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  setCell(ws, 2, 8, '', { fill: YELLOW_FILL })
  ws.mergeCells(2, 7, 2, 8)

  setCell(ws, 2, 9, 'Closing Time', { font: FONT_BOLD, fill: HDR_FILL })
  setCell(ws, 2, 10, '9;00pm', {
    fill: YELLOW_FILL,
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  setCell(ws, 2, 11, '', { fill: YELLOW_FILL })
  ws.mergeCells(2, 10, 2, 11)

  // ─── R3: blank separator ────────────────────────────────────────────
  for (let c = 1; c <= 11; c++) setCell(ws, 3, c, '', { border: undefined })

  // ─── R4: Fuel sales headers ─────────────────────────────────────────
  setCell(ws, 4, 1, '', { fill: HDR_FILL })
  const fuelHeaders = [
    'Price 1', 'Actual Sales @P1', 'RTT @P1', 'Cons. @P1',
    'Price 2', 'Actual Sales @P2', 'RTT @P2', 'Cons. @P2',
    'Total Actual Sales (Ltrs)', 'Amount (N)',
  ]
  fuelHeaders.forEach((h, i) => colHeaderCell(ws, 4, 2 + i, h))

  // ─── R5–R7: PMS/AGO/DPK fuel rows ───────────────────────────────────
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = FUEL_ROWS[ft]
    const f = fuelByType[ft] || {}
    setCell(ws, row, 1, ft, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setNum(ws, row, 2, f.price1,        { fill: YELLOW_FILL })
    setNum(ws, row, 3, f.actualSalesP1, { fill: YELLOW_FILL })
    setNum(ws, row, 4, f.rttP1,         { fill: YELLOW_FILL })
    setNum(ws, row, 5, f.consP1,        { fill: YELLOW_FILL })
    setNum(ws, row, 6, f.price2,        { fill: YELLOW_FILL })
    setNum(ws, row, 7, f.actualSalesP2, { fill: YELLOW_FILL })
    setNum(ws, row, 8, f.rttP2,         { fill: YELLOW_FILL })
    setNum(ws, row, 9, f.consP2,        { fill: YELLOW_FILL })
    setFormula(ws, row, 10, `C${row}+G${row}`,                  f.totalActualLtrs || 0)
    setFormula(ws, row, 11, `(B${row}*C${row})+(F${row}*G${row})`, f.amount || 0)
  }

  // ─── R8: LUBES row ──────────────────────────────────────────────────
  setCell(ws, LUBES_ROW, 1, 'LUBES', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
  for (let c = 2; c <= 10; c++) setCell(ws, LUBES_ROW, c, '', { fill: YELLOW_FILL })
  setCell(ws, LUBES_ROW, 11, '', {}) // K8 wired up later once lube total row known

  // ─── R9: STOCK INVENTORY section header ─────────────────────────────
  sectionHeader(ws, 9, 'STOCK INVENTORY (LITRES)')

  // ─── R10: stock headers ─────────────────────────────────────────────
  setCell(ws, 10, 1, '', { fill: HDR_FILL })
  const stockHeaders = ['Opening stock', 'Waybill Qty Supplied', 'Actual Qty Received', 'Truck Shortage', 'Total Dispensed', 'Closing stock']
  stockHeaders.forEach((h, i) => colHeaderCell(ws, 10, 2 + i, h))
  for (let c = 8; c <= 11; c++) setCell(ws, 10, c, '', { fill: HDR_FILL })

  // ─── R11–R13: stock rows ────────────────────────────────────────────
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = STOCK_ROWS[ft]
    const fuelRow = FUEL_ROWS[ft]
    const s = stockByType[ft] || {}
    setCell(ws, row, 1, ft, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setNum(ws, row, 2, s.opening,        { fill: YELLOW_FILL })
    setNum(ws, row, 3, s.waybill,        { fill: YELLOW_FILL })
    setNum(ws, row, 4, s.actualReceived, { fill: YELLOW_FILL })
    setFormula(ws, row, 5, `D${row}-C${row}`, (s.actualReceived || 0) - (s.waybill || 0))
    setFormula(ws, row, 6, `C${fuelRow}+D${fuelRow}+E${fuelRow}+G${fuelRow}+H${fuelRow}+I${fuelRow}`, s.totalDispensed || 0)
    setNum(ws, row, 7, s.closing,        { fill: YELLOW_FILL })
    for (let c = 8; c <= 11; c++) setCell(ws, row, c, '', {})
  }

  // ─── R14: STOCK RECONCILIATION header ───────────────────────────────
  sectionHeader(ws, 14, 'STOCK RECONCILIATION (Litres)')

  // ─── R15: recon headers ─────────────────────────────────────────────
  setCell(ws, 15, 1, '', { fill: HDR_FILL })
  colHeaderCell(ws, 15, 2, 'Expected Overage')
  colHeaderCell(ws, 15, 3, 'Actual Overage')
  colHeaderCell(ws, 15, 4, 'Variance')
  for (let c = 5; c <= 11; c++) setCell(ws, 15, c, '', { fill: HDR_FILL })

  // ─── R16–R18: recon rows ────────────────────────────────────────────
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = RECON_ROWS[ft]
    const stockRow = STOCK_ROWS[ft]
    const fuelRow  = FUEL_ROWS[ft]
    const s = stockByType[ft] || {}
    const f = fuelByType[ft]  || {}
    const expectedOverage = (s.opening + s.waybill - s.closing) * 0.01
    const actualOverage = (s.totalDispensed || 0) - (s.opening + s.waybill - s.closing) - ((f.rttP1 || 0) + (f.rttP2 || 0))
    const variance = actualOverage - expectedOverage

    setCell(ws, row, 1, ft, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setFormula(ws, row, 2, `(B${stockRow}+C${stockRow}-G${stockRow})*0.01`, expectedOverage)
    setFormula(ws, row, 3, `F${stockRow}-(B${stockRow}+C${stockRow}-G${stockRow})-(D${fuelRow}+H${fuelRow})`, actualOverage)
    setFormula(ws, row, 4, `C${row}-B${row}`, variance)
    const msg = variance > 0 ? 'Liquid height variance' : ''
    for (let c = 5; c <= 11; c++) {
      const cell = ws.getCell(row, c)
      cell.value = { formula: `IF(D${row}>0, "Liquid height variance", "")`, result: msg }
      applyStyle(cell, { font: FONT, border: BORDER_THIN, alignment: { horizontal: 'left', vertical: 'middle' } })
    }
  }

  // ─── R19: blank separator ───────────────────────────────────────────
  for (let c = 1; c <= 11; c++) setCell(ws, 19, c, '', { border: undefined })

  // ─── R20: deposit + POS headers ─────────────────────────────────────
  setCell(ws, 20, 1, '', { fill: HDR_FILL })
  const bankHeaders = ['Deposit 1', 'Deposit 2', 'Deposit 3', 'Deposit 4', 'Bank POS 1', 'Bank POS 2', 'Bank POS 3', 'Bank POS 4', 'Bank POS 5', 'Bank POS 6']
  bankHeaders.forEach((h, i) => colHeaderCell(ws, 20, 2 + i, h))

  // ─── R21: amounts ───────────────────────────────────────────────────
  const deposits = sheet.bankRows.deposits
  const pos = sheet.bankRows.pos
  setCell(ws, 21, 1, 'Amount (₦)', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
  for (let i = 0; i < 4; i++) {
    setNum(ws, 21, 2 + i, deposits[i]?.amount, { fill: YELLOW_FILL })
  }
  for (let i = 0; i < 6; i++) {
    setNum(ws, 21, 6 + i, pos[i]?.amount, { fill: YELLOW_FILL })
  }

  // ─── R22: bank names ────────────────────────────────────────────────
  setCell(ws, 22, 1, 'Bank', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
  for (let i = 0; i < 4; i++) {
    setCell(ws, 22, 2 + i, deposits[i]?.bankName || '', {
      fill: YELLOW_FILL,
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
  }
  for (let i = 0; i < 6; i++) {
    setCell(ws, 22, 6 + i, pos[i]?.bankName || '', {
      fill: YELLOW_FILL,
      alignment: { horizontal: 'center', vertical: 'middle' },
    })
  }

  // ─── R23: CASH RECON header ─────────────────────────────────────────
  sectionHeader(ws, 23, 'CASH RECONCILIATION (₦)')

  // ─── R24: cash recon headers ────────────────────────────────────────
  setCell(ws, 24, 1, '', { fill: HDR_FILL })
  const cashHeaders = ['Total Expected Sales', 'Previous Day Cash @ Hand', 'Total Bank Deposit', 'Total POS', 'Expected Cash @ Hand', 'Actual Cash @ Hand', 'Variance in Cash']
  cashHeaders.forEach((h, i) => colHeaderCell(ws, 24, 2 + i, h))
  colHeaderCell(ws, 24, 9, 'Reason for Cash Variance')
  setCell(ws, 24, 10, '', { fill: HDR_FILL })
  setCell(ws, 24, 11, '', { fill: HDR_FILL })
  ws.mergeCells(24, 9, 24, 11)

  // ─── R25: cash recon values ─────────────────────────────────────────
  const cash = sheet.cash
  setCell(ws, 25, 1, 'Amount (₦)', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
  setFormula(ws, 25, 2, `SUM(K5:K8)`, cash.totalExpectedSales)
  setNum(ws, 25, 3, cash.prevDayCash, { fill: YELLOW_FILL })
  setFormula(ws, 25, 4, `B21+C21+D21+E21`, cash.totalBankDeposit)
  setFormula(ws, 25, 5, `SUM(F21:K21)`, cash.totalPOS)
  setFormula(ws, 25, 6, `B25+C25-D25-E25`, cash.expectedCashAtHand)
  setNum(ws, 25, 7, cash.actualCashAtHand, { fill: YELLOW_FILL })
  setFormula(ws, 25, 8, `G25-F25`, cash.variance)
  setCell(ws, 25, 9, cash.reason || '', { fill: YELLOW_FILL, align: 'left' })
  setCell(ws, 25, 10, '', { fill: YELLOW_FILL })
  setCell(ws, 25, 11, '', { fill: YELLOW_FILL })
  ws.mergeCells(25, 9, 25, 11)

  // ─── R26: blank ─────────────────────────────────────────────────────
  for (let c = 1; c <= 11; c++) setCell(ws, 26, c, '', { border: undefined })

  // ─── R27: budget headers ────────────────────────────────────────────
  setCell(ws, 27, 1, '', { fill: HDR_FILL })
  colHeaderCell(ws, 27, 2, 'Budget (Ltrs)')
  colHeaderCell(ws, 27, 3, 'Achievement')
  colHeaderCell(ws, 27, 4, 'Variance (Ltrs)')
  colHeaderCell(ws, 27, 5, 'Comments on Sales Achievement')
  for (let c = 6; c <= 11; c++) setCell(ws, 27, c, '', { fill: HDR_FILL })
  ws.mergeCells(27, 5, 27, 11)

  // ─── R28–R30: budget rows (placeholder values match reference) ──────
  const BUDGET_PLACEHOLDER = { PMS: 14400, AGO: 480, DPK: 240 }
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = BUDGET_ROWS[ft]
    const fuelRow = FUEL_ROWS[ft]
    const budget = BUDGET_PLACEHOLDER[ft]
    setCell(ws, row, 1, ft, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setNum(ws, row, 2, budget, { fill: YELLOW_FILL })
    setFormula(ws, row, 3, `J${fuelRow}/B${row}`, 0, { numFmt: '0.0%' })
    setFormula(ws, row, 4, `J${fuelRow}-B${row}`, -budget)
    for (let c = 5; c <= 11; c++) {
      const cell = ws.getCell(row, c)
      cell.value = { formula: `IF(D${row}<0, "Low Demand", "High Demand")`, result: 'Low Demand' }
      applyStyle(cell, { font: FONT, border: BORDER_THIN, alignment: { horizontal: 'center', vertical: 'middle' } })
    }
    ws.mergeCells(row, 5, row, 11)
  }

  // ─── R31: LUBES budget (placeholder zeros match reference) ──────────
  setCell(ws, 31, 1, 'LUBES', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
  setNum(ws, 31, 2, 0, { fill: YELLOW_FILL })
  setNum(ws, 31, 3, 0, { fill: YELLOW_FILL })
  setNum(ws, 31, 4, 0, { fill: YELLOW_FILL })
  for (let c = 5; c <= 11; c++) setCell(ws, 31, c, '', {})
  ws.mergeCells(31, 5, 31, 11)

  // ─── R32: blank separator ───────────────────────────────────────────
  for (let c = 1; c <= 11; c++) setCell(ws, 32, c, '', { border: undefined })

  // ─── R33: competitor headers ────────────────────────────────────────
  setCell(ws, 33, 1, '', { fill: HDR_FILL })
  colHeaderCell(ws, 33, 2, 'Rainoil')
  colHeaderCell(ws, 33, 3, 'Competitor 1')
  colHeaderCell(ws, 33, 4, 'Price 1')
  colHeaderCell(ws, 33, 5, 'Competitor 2')
  colHeaderCell(ws, 33, 6, 'Price 2')
  colHeaderCell(ws, 33, 7, 'Competitor 3')
  colHeaderCell(ws, 33, 8, 'Price 3')
  colHeaderCell(ws, 33, 9, 'Competitor 4')
  colHeaderCell(ws, 33, 10, 'Price 4')
  setCell(ws, 33, 11, '', { fill: HDR_FILL })

  // ─── R34–R36: competitor rows (placeholder values match reference) ──
  const COMP_PLACEHOLDER = {
    PMS: { rainoil: 537, c1: 'PRIME',  p1: 6,   c2: 'NNPC', p2: 511, c3: 'YOZIDDA', p3: 511, c4: 'NASKO', p4: 505 },
    AGO: { rainoil: 650, c1: 'Conoil', p1: 650, c2: 'NNPC', p2: 670, c3: 'YOZIDDA', p3: 680, c4: 'NASKO', p4: 680 },
    DPK: { rainoil: 700, c1: 'PRIME',  p1: 'NIL', c2: 'NNPC', p2: 0, c3: 'YOZZIDA', p3: 0, c4: 'NASKO', p4: 'NIL' },
  }
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = COMP_ROWS[ft]
    const c = COMP_PLACEHOLDER[ft]
    setCell(ws, row, 1, ft, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setNum(ws, row, 2, c.rainoil, { fill: YELLOW_FILL })
    setCell(ws, row, 3, c.c1, { fill: YELLOW_FILL, alignment: { horizontal: 'center', vertical: 'middle' } })
    if (typeof c.p1 === 'number') setNum(ws, row, 4, c.p1, { fill: YELLOW_FILL })
    else setCell(ws, row, 4, c.p1, { fill: YELLOW_FILL, alignment: { horizontal: 'center', vertical: 'middle' } })
    setCell(ws, row, 5, c.c2, { fill: YELLOW_FILL, alignment: { horizontal: 'center', vertical: 'middle' } })
    setNum(ws, row, 6, c.p2, { fill: YELLOW_FILL })
    setCell(ws, row, 7, c.c3, { fill: YELLOW_FILL, alignment: { horizontal: 'center', vertical: 'middle' } })
    setNum(ws, row, 8, c.p3, { fill: YELLOW_FILL })
    setCell(ws, row, 9, c.c4, { fill: YELLOW_FILL, alignment: { horizontal: 'center', vertical: 'middle' } })
    if (typeof c.p4 === 'number') setNum(ws, row, 10, c.p4, { fill: YELLOW_FILL })
    else setCell(ws, row, 10, c.p4, { fill: YELLOW_FILL, alignment: { horizontal: 'center', vertical: 'middle' } })
    setCell(ws, row, 11, '', {})
  }

  // ─── R37: LUBE BREAKDOWN header ─────────────────────────────────────
  sectionHeader(ws, 37, 'LUBE SALES BREAKDOWN')

  // ─── R38: lube headers ──────────────────────────────────────────────
  setCell(ws, 38, 1, '', { fill: HDR_FILL })
  setCell(ws, 38, 2, '', { fill: HDR_FILL })
  colHeaderCell(ws, 38, 3, 'Litre')
  colHeaderCell(ws, 38, 4, 'Unit Price')
  colHeaderCell(ws, 38, 5, 'Opening Stock Units')
  colHeaderCell(ws, 38, 6, 'Product Supply Units')
  colHeaderCell(ws, 38, 7, 'Sales Units')
  colHeaderCell(ws, 38, 8, 'Closing Stock Units')
  colHeaderCell(ws, 38, 9, 'Amount (₦)')
  colHeaderCell(ws, 38, 10, 'Variance Units')
  setCell(ws, 38, 11, '', { fill: HDR_FILL })

  // ─── R39+: lube product rows ────────────────────────────────────────
  const firstLubeRow = 39
  const lubeItems = sheet.lube || []
  let row = firstLubeRow
  for (const item of lubeItems) {
    setCell(ws, row, 1, item.productName, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setCell(ws, row, 2, item.productName, { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setNum(ws, row, 3, item.litre,        { fill: YELLOW_FILL })
    setNum(ws, row, 4, item.unitPrice,    { fill: YELLOW_FILL })
    setNum(ws, row, 5, item.openingStock, { fill: YELLOW_FILL })
    setNum(ws, row, 6, item.productSupply,{ fill: YELLOW_FILL })
    setFormula(ws, row, 7, `E${row}+F${row}-H${row}`, item.sales || 0)
    setNum(ws, row, 8, item.closingStock, { fill: YELLOW_FILL })
    setFormula(ws, row, 9, `G${row}*D${row}`, item.amount || 0)
    setFormula(ws, row, 10, `G${row}+H${row}-E${row}-F${row}`, item.variance || 0)
    setCell(ws, row, 11, '', {})
    row++
  }

  // TOTAL row + wire R8 LUBES amount
  if (lubeItems.length > 0) {
    const totalRow = row
    const lastRow = totalRow - 1
    const sums = lubeItems.reduce((a, i) => ({
      opening: a.opening + (i.openingStock || 0),
      supply:  a.supply  + (i.productSupply || 0),
      sales:   a.sales   + (i.sales || 0),
      closing: a.closing + (i.closingStock || 0),
      amount:  a.amount  + (i.amount || 0),
      variance:a.variance+ (i.variance || 0),
    }), { opening: 0, supply: 0, sales: 0, closing: 0, amount: 0, variance: 0 })

    setCell(ws, totalRow, 1, 'TOTAL', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setCell(ws, totalRow, 2, 'TOTAL', { font: FONT_BOLD, fill: HDR_FILL, align: 'left' })
    setCell(ws, totalRow, 3, '', { fill: HDR_FILL })
    setCell(ws, totalRow, 4, '', { fill: HDR_FILL })
    setFormula(ws, totalRow, 5,  `SUM(E${firstLubeRow}:E${lastRow})`, sums.opening)
    setFormula(ws, totalRow, 6,  `SUM(F${firstLubeRow}:F${lastRow})`, sums.supply)
    setFormula(ws, totalRow, 7,  `SUM(G${firstLubeRow}:G${lastRow})`, sums.sales)
    setFormula(ws, totalRow, 8,  `SUM(H${firstLubeRow}:H${lastRow})`, sums.closing)
    setFormula(ws, totalRow, 9,  `SUM(I${firstLubeRow}:I${lastRow})`, sums.amount)
    setFormula(ws, totalRow, 10, `SUM(J${firstLubeRow}:J${lastRow})`, sums.variance)
    setCell(ws, totalRow, 11, '', { fill: HDR_FILL })

    setFormula(ws, LUBES_ROW, 11, `I${totalRow}`, sums.amount)
  } else {
    setCell(ws, LUBES_ROW, 11, '', {})
  }

  // Apply medium outer-border to the whole grid (cols A:K, rows 1..lastRow)
  const lastRow = lubeItems.length > 0 ? firstLubeRow + lubeItems.length : firstLubeRow
  for (let c = 1; c <= 11; c++) {
    const top = ws.getCell(1, c)
    const bot = ws.getCell(lastRow, c)
    top.border = { ...(top.border || {}), top: MED }
    bot.border = { ...(bot.border || {}), bottom: MED }
  }
  for (let r = 1; r <= lastRow; r++) {
    const left = ws.getCell(r, 1)
    const right = ws.getCell(r, 11)
    left.border = { ...(left.border || {}), left: MED }
    right.border = { ...(right.border || {}), right: MED }
  }
}

function safeSheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, '_').slice(0, 31)
}

function buildFilename(stationName, startDate, endDate) {
  const station = (stationName || 'Station').replace(/[\\/?*[\]:]/g, '').trim()
  return `${station} Sales Operation ${startDate} to ${endDate}.xlsx`
}

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
    buildSheet(ws, sheet, stationName)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, buildFilename(stationName, startDate, endDate))
}
