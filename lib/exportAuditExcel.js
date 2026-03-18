import ExcelJS from 'exceljs'

/**
 * Audit Report Excel export — matches the reference template exactly.
 * Sheet order: 1.Guideline, 2.Sales>>Cash Position, 3.Stock Position,
 * 4.Lodgement Sheet, 5-7.Consumption, 8.Product Received,
 * 9.Expenses, 10.Record of Stock Position, Customers' Ledger,
 * Castro Lubricants, Sheet1 (2)
 */

// ─── Styling constants ──────────────────────────────────────
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { theme: 4 } }

const FONT = { name: 'Corbel', size: 11, color: { theme: 1 } }
const FONT_BOLD = { name: 'Corbel', size: 11, bold: true, color: { theme: 1 } }
const FONT_10 = { name: 'Corbel', size: 10, color: { theme: 1 } }
const FONT_10_BOLD = { name: 'Corbel', size: 10, bold: true, color: { theme: 1 } }
const FONT_12_BOLD = { name: 'Corbel', size: 12, bold: true, color: { theme: 1 } }
const FONT_12_BOLD_UL = { name: 'Corbel', size: 12, bold: true, underline: true, color: { theme: 1 } }
const RED_FONT = { name: 'Corbel', size: 11, bold: true, color: { argb: 'FFFF0000' } }
const RED_FONT_10 = { name: 'Corbel', size: 10, bold: true, color: { argb: 'FFFF0000' } }

// Calibri variants for Lubricants sheet
const CAL_FONT = { name: 'Calibri', size: 11, color: { theme: 1 } }
const CAL_BOLD = { name: 'Calibri', size: 11, bold: true, color: { theme: 1 } }
const CAL_12_BOLD = { name: 'Calibri', size: 12, bold: true, color: { theme: 1 } }
const CAL_TITLE = { name: 'Calibri', size: 14, bold: true, color: { theme: 1 } }
const CAL_RED = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFF0000' } }

// Arial variants for Customers' Ledger
const ARIAL_FONT = { name: 'Arial', size: 11, color: { theme: 1 } }
const ARIAL_BOLD = { name: 'Arial', size: 11, bold: true, color: { theme: 1 } }
const ARIAL_TITLE = { name: 'Arial', size: 14, bold: true, color: { theme: 1 } }

// Border styles
// THIN = all 4 sides thin — standard data row border matching reference
const BORDER_THIN = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
// HDR = header row: medium top+bottom, thin left+right
const BORDER_HDR = {
  top: { style: 'medium' }, bottom: { style: 'medium' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
const BORDER_HDR_L = { ...BORDER_HDR, left: { style: 'medium' } }
const BORDER_HDR_R = { ...BORDER_HDR, right: { style: 'medium' } }
const BORDER_HDR_LR = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }
// HDR_TB = medium top+bottom only (no left/right — for merged interiors)
const BORDER_HDR_TB = { top: { style: 'medium' }, bottom: { style: 'medium' } }
const BORDER_TOTAL = {
  top: { style: 'thin' }, bottom: { style: 'double' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
const BORDER_MED_BOX = {
  top: { style: 'medium' }, bottom: { style: 'medium' },
  left: { style: 'medium' }, right: { style: 'medium' },
}

// Border for sheets where data rows have NO top border (Lodgement, Consumption, Expenses, Record)
const BORDER_DATA = {
  bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}

// Number formats
const ACCT_FMT = '_-* #,##0_-;-* #,##0_-;_-* "-"??_-;_-@_-'
const ACCT_FMT_PLAIN = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-'
const ACCT_FMT_2 = '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-'
const ACCT_PAREN = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)'
const ACCT_PAREN_2 = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)'
const NUM_FMT = '#,##0'
const DATE_FMT = 'mm-dd-yy'
const MMM_YY = 'mmm-yy'

// ─── Style helpers ───────────────────────────────────────────

function applyStyle(cell, style) {
  if (style.font) cell.font = style.font
  if (style.fill) cell.fill = style.fill
  if (style.border) cell.border = style.border
  if (style.alignment) cell.alignment = style.alignment
}

function hdrStyle(font, border) {
  return { font: font || FONT_BOLD, border: border || BORDER_HDR, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } }
}
function dataStyle(align = 'center', font) {
  return { font: font || FONT, border: BORDER_THIN, alignment: { horizontal: align } }
}
function dataStyleYellow(align = 'center', font) {
  return { font: font || FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: align } }
}
function boldStyle(align = 'center', font) {
  return { font: font || FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: align } }
}
function totalStyle(align = 'center', font) {
  return { font: font || FONT_BOLD, border: BORDER_TOTAL, alignment: { horizontal: align } }
}

/**
 * Style all cells in a row range — including empty cells.
 * Applies the given border/font/fill to every column from firstCol to lastCol.
 * This ensures empty cells still have the grid border pattern.
 */
function styleRowRange(ws, row, firstCol, lastCol, style) {
  for (let c = firstCol; c <= lastCol; c++) {
    const cell = ws.getRow(row).getCell(c)
    applyStyle(cell, style)
  }
}

/**
 * Fill a grid with borders on ALL cells (including empty ones).
 * - Empty cells get BORDER_DATA + font
 * - Edge columns get medium left/right borders
 * - Existing cells keep their borders but get edge upgrades
 */
function fillGrid(ws, startRow, endRow, firstCol, lastCol, font) {
  const f = font || FONT
  for (let r = startRow; r <= endRow; r++) {
    for (let c = firstCol; c <= lastCol; c++) {
      const cell = ws.getRow(r).getCell(c)
      const hasBorder = cell.border && Object.keys(cell.border).length > 0

      if (!hasBorder) {
        // Empty cell — apply thin border + font
        let border = { ...BORDER_THIN }
        if (c === firstCol) border = { ...border, left: { style: 'medium' } }
        if (c === lastCol) border = { ...border, right: { style: 'medium' } }
        cell.border = border
        if (!cell.font || !cell.font.name) cell.font = f
      } else {
        // Existing cell — upgrade edge borders to medium
        if (c === firstCol) cell.border = { ...cell.border, left: { style: 'medium' } }
        if (c === lastCol) cell.border = { ...cell.border, right: { style: 'medium' } }
      }
    }
  }
}

/**
 * Fill header row with proper edge borders (medium on first/last col).
 */
function fillHeaderRow(ws, row, firstCol, lastCol, font) {
  for (let c = firstCol; c <= lastCol; c++) {
    const cell = ws.getRow(row).getCell(c)
    const hasBorder = cell.border && Object.keys(cell.border).length > 0
    if (!hasBorder) {
      let border = { ...BORDER_HDR }
      if (c === firstCol) border = { ...border, left: { style: 'medium' } }
      if (c === lastCol) border = { ...border, right: { style: 'medium' } }
      cell.border = border
      if (font && (!cell.font || !cell.font.name)) cell.font = font
    } else {
      if (c === firstCol) cell.border = { ...cell.border, left: { style: 'medium' } }
      if (c === lastCol) cell.border = { ...cell.border, right: { style: 'medium' } }
    }
  }
}

function numCell(ws, r, c, value, style, fmt) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = (value != null && value !== '' && !isNaN(value)) ? Number(value) : null
  cell.numFmt = fmt || ACCT_FMT
  applyStyle(cell, style || dataStyle())
}
function yellowNum(ws, r, c, value, style, fmt) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = (value != null && value !== '' && !isNaN(value)) ? Number(value) : null
  cell.numFmt = fmt || ACCT_FMT
  applyStyle(cell, style || dataStyleYellow())
}
function textCell(ws, r, c, value, style) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = value ?? ''
  applyStyle(cell, style || dataStyle('left'))
}
function dateCell(ws, r, c, dateStr, style) {
  const cell = ws.getRow(r).getCell(c)
  if (dateStr) {
    cell.value = new Date(dateStr + 'T00:00:00')
  } else {
    cell.value = null
  }
  cell.numFmt = DATE_FMT
  applyStyle(cell, style || dataStyle('left'))
}
function formulaCell(ws, r, c, formula, style, fmt) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = { formula }
  cell.numFmt = fmt || ACCT_FMT
  applyStyle(cell, style || dataStyle())
}
function formulaYellow(ws, r, c, formula, style, fmt) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = { formula }
  cell.numFmt = fmt || ACCT_FMT
  applyStyle(cell, style || dataStyleYellow())
}

function unlockNonFormulaCells(ws) {
  const maxRow = ws.rowCount || 0
  const maxCol = ws.columnCount || 0
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c)
      const val = cell.value
      const isFormula = val && typeof val === 'object' && val.formula
      if (!isFormula) {
        cell.protection = { locked: false }
      }
    }
  }
}

function colLetter(c) {
  if (c <= 26) return String.fromCharCode(64 + c)
  return String.fromCharCode(64 + Math.floor((c - 1) / 26)) + String.fromCharCode(65 + ((c - 1) % 26))
}

const fmtDateDisplay = (d) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Main Export ─────────────────────────────────────────────

export async function exportAuditExcel({
  report, receipts, lubeSales, lubeStock, lubeProducts,
  tanks, nozzles, stationName, startDate, endDate,
  expenses, customers,
}) {
  if (!report) throw new Error('No report data')

  const wb = new ExcelJS.Workbook()

  // Track row references for cross-sheet formulas
  const refs = {}

  writeGuideline(wb)
  writeSalesCash(wb, report, stationName, startDate, endDate, refs)
  writeStockPosition(wb, report, stationName, startDate, endDate, refs)
  writeLodgement(wb, report, stationName, startDate, endDate, refs)
  writeConsumption(wb, report, startDate, endDate, 'PMS', '5.PMS Consumption and Pour back')
  writeConsumption(wb, report, startDate, endDate, 'AGO', '6.AGO Consumption and Pour back')
  writeConsumption(wb, report, startDate, endDate, 'DPK', '7.DPK Consumption and Pour back')
  writeProductReceived(wb, receipts, tanks, startDate, endDate, refs)
  writeExpenses(wb, expenses)
  writeRecordOfStock(wb, report, refs)
  writeCustomersLedger(wb, customers)
  writeLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate)
  writeSheet1Copy(wb)

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Audit Report ${startDate} to ${endDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)

  return { warnings: [] }
}

// ─── 1. Guideline ────────────────────────────────────────────

function writeGuideline(wb) {
  const ws = wb.addWorksheet('1.Guideline')
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', style: 'pageBreakPreview', zoomScale: 86, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 64, fitToPage: false, printArea: 'A1:D18' }
  ws.getColumn(1).width = 10.57
  ws.getColumn(2).width = 18.57
  ws.getColumn(3).width = 92.71

  const labelStyle = { font: FONT_BOLD, border: { left: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }, alignment: { horizontal: 'left', vertical: 'top' } }
  const contentStyle = { font: FONT, border: { right: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }, alignment: { horizontal: 'left', vertical: 'top', wrapText: true } }

  textCell(ws, 2, 2, 'From>>', labelStyle)
  textCell(ws, 2, 3, 'Internal Audit Department', contentStyle)

  textCell(ws, 3, 2, 'User>>', labelStyle)
  textCell(ws, 3, 3, 'Station and Depot Operations', contentStyle)

  textCell(ws, 4, 2, 'Date of issue>>', labelStyle)
  const dateCell4 = ws.getRow(4).getCell(3)
  dateCell4.value = new Date('2020-01-01T00:00:00')
  dateCell4.numFmt = MMM_YY
  applyStyle(dateCell4, contentStyle)

  textCell(ws, 6, 2, 'Objective', labelStyle)
  ws.getRow(6).height = 76.5
  ws.getRow(6).getCell(3).value = {
    richText: [
      { font: { ...FONT, size: 11 }, text: 'The objective of this report is to present the ' },
      { font: { ...FONT_BOLD, size: 11 }, text: 'Sales/Cash' },
      { font: { ...FONT, size: 11 }, text: ' and ' },
      { font: { ...FONT_BOLD, size: 11 }, text: 'Stock position' },
      { font: { ...FONT, size: 11 }, text: ' of the Station on a weekly basis.' },
    ]
  }
  applyStyle(ws.getRow(6).getCell(3), contentStyle)

  textCell(ws, 8, 2, 'Instruction', labelStyle)
  ws.getRow(8).height = 282.75
  ws.getRow(8).getCell(3).value = {
    richText: [
      { font: { ...FONT, size: 11 }, text: '1. This report should be completed and submitted on a weekly basis.\nFor example, the report for the week should be submitted by Monday of the following week.\n\n2. This template is divided into the following sheets:\n' },
      { font: { ...FONT_BOLD, size: 11 }, text: 'Sheet 2 (Sales/Cash Position)' },
      { font: { ...FONT, size: 11 }, text: ' contains the Sales/Cash position reconciliation.\n' },
      { font: { ...FONT_BOLD, size: 11 }, text: 'Sheet 3 (Stock Position)' },
      { font: { ...FONT, size: 11 }, text: ' has figures that are auto-generated from other sheets.\nCells ' },
      { font: { ...FONT_BOLD, size: 11 }, text: 'highlighted in "Yellow"' },
      { font: { ...FONT, size: 11 }, text: ' are formula cells.\n..PLEASE do not bother to edit such cells.' },
    ]
  }
  applyStyle(ws.getRow(8).getCell(3), contentStyle)

  textCell(ws, 10, 2, 'Audit Contact', labelStyle)
  ws.getRow(10).height = 150.75
  ws.getRow(10).getCell(3).value = {
    richText: [
      { font: { ...FONT, size: 11 }, text: 'All the sheets must be filled in to show the ' },
      { font: { ...FONT_BOLD, size: 11 }, text: 'Cash and Stock Position' },
      { font: { ...FONT, size: 11 }, text: ' of the Station on a weekly basis.' },
    ]
  }
  applyStyle(ws.getRow(10).getCell(3), contentStyle)

  // Guideline has no grid — only the label+content pairs with their own borders
}

// ─── 2. Sales>>Cash Position ─────────────────────────────────

function writeSalesCash(wb, report, stationName, startDate, endDate, refs) {
  const ws = wb.addWorksheet('2. Sales>>Cash Position', { properties: { tabColor: { argb: 'FFFFFF00' } } })
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8, topLeftCell: 'A10', style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { scale: 18, printArea: 'A1:H250' }
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })
  const { salesCash, fuelTypes } = report
  if (!salesCash) return

  // Column widths matching reference
  ws.getColumn(1).width = 9.29   // A
  ws.getColumn(2).width = 15.71  // B
  ws.getColumn(3).width = 38     // C
  ws.getColumn(4).width = 22.57  // D
  ws.getColumn(5).width = 26.57  // E - dispensed (yellow)
  ws.getColumn(6).width = 15.71  // F - price
  ws.getColumn(7).width = 16.71  // G - amount (yellow)
  ws.getColumn(8).width = 9.57   // H
  ws.getColumn(9).width = 9.29   // I
  ws.getColumn(10).width = 12.29 // J
  ws.getColumn(11).width = 9.29  // K
  ws.getColumn(12).width = 11.29 // L

  // Row 3: Station name + title
  textCell(ws, 3, 2, ' STATION NAME: ', { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  textCell(ws, 3, 3, stationName || '', { font: FONT_BOLD, fill: BLUE_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  const titleText = `CASH/SALES RECONCILIATION AS  AT ${fmtDateDisplay(startDate)} - ${fmtDateDisplay(endDate)}`
  textCell(ws, 3, 4, titleText, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'center' } })
  ws.mergeCells('D3:E3')
  ws.getRow(3).height = 15.75

  // Row 5: Period of audit
  textCell(ws, 5, 2, 'Period of Audit', { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  const periodText = `${fmtDateDisplay(startDate)}- ${fmtDateDisplay(endDate)}`
  textCell(ws, 5, 3, periodText, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'center' } })
  ws.mergeCells('C5:F5')

  // Track important row references per fuel type
  refs.sales = {}
  let row = 7

  // Fixed row allocations per fuel type (matching reference template)
  const FUEL_ALLOC = {
    PMS: { pumpRows: 77, pourBackRows: 5, consumeRows: 12 },
    AGO: { pumpRows: 29, pourBackRows: 6, consumeRows: 17 },
    DPK: { pumpRows: 24, pourBackRows: 6, consumeRows: 3 },
  }

  // Default account names pre-filled per fuel type (matching reference)
  const DEFAULT_CONSUME_NAMES = {
    PMS: ['Police', 'Manager Car', 'Manager Car', 'DSS OFFICIALS', 'Army', 'EDSTMA', 'Weight and Measures', 'Vigilante', 'Security Agents', 'Security Agents', 'Regional Manager Car', 'Area Manager Car'],
    AGO: ['Generator', 'Generator', 'Generator', 'Generator', 'Generator', 'Generator', 'MDS Logistics Truck', 'Logistics Truck'],
    DPK: [null, null, 'Weight and Measures'],
  }
  const DEFAULT_POURBACK_NAMES = {
    PMS: [],
    AGO: ['LOGISTICS', 'LOGISTICS', 'Weight and measure', 'Pour Back After Pump Repairs'],
    DPK: [],
  }

  for (let ftIdx = 0; ftIdx < fuelTypes.length; ftIdx++) {
    const ft = fuelTypes[ftIdx]
    const summary = salesCash.fuelSummaries[ft]
    if (!summary) continue

    const alloc = FUEL_ALLOC[ft] || { pumpRows: 77, pourBackRows: 5, consumeRows: 12 }
    const ftRefs = { firstDataRow: 0, lastDataRow: 0, totalARow: 0, pourBackStart: 0, pourBackEnd: 0, netRow: 0, consumeStart: 0, consumeEnd: 0, totalDRow: 0, expectedRow: 0 }
    refs.sales[ft] = ftRefs

    // Section header
    textCell(ws, row, 2, String(ftIdx + 1), { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    textCell(ws, row, 3, `${ft} Sales for the Period`, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    ws.mergeCells(row, 3, row, 4)
    row++

    // Meter reading headers
    textCell(ws, row, 2, 'Meter reading', hdrStyle(FONT_BOLD))
    textCell(ws, row, 3, `Opening (${fmtDateDisplay(startDate)})`, hdrStyle(FONT_BOLD))
    textCell(ws, row, 4, `Closing (${fmtDateDisplay(endDate)})`, hdrStyle(FONT_BOLD))
    textCell(ws, row, 5, '    ', hdrStyle(FONT_BOLD))
    textCell(ws, row, 6, 'Price', hdrStyle(FONT_BOLD))
    textCell(ws, row, 7, 'Amount', hdrStyle(FONT_BOLD))
    row++

    // Blank spacer row before data
    row++

    ftRefs.firstDataRow = row

    // Write pump data into fixed allocation (2 empty rows between each price group)
    const spacerPerGroup = 2
    const dataRowsNeeded = summary.rows.reduce((s, p) => s + p.pumps.length, 0) + (summary.rows.length - 1) * spacerPerGroup
    const pumpAlloc = Math.max(alloc.pumpRows, dataRowsNeeded)
    let rowsUsed = 0
    for (let ri = 0; ri < summary.rows.length; ri++) {
      const period = summary.rows[ri]

      if (ri > 0) {
        // 2 empty rows between price groups (formulas only, no data)
        for (let s = 0; s < spacerPerGroup; s++) {
          formulaYellow(ws, row, 5, `D${row}-C${row}`, dataStyleYellow(), ACCT_FMT_PLAIN)
          formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow(), ACCT_FMT_PLAIN)
          row++
          rowsUsed++
        }
      }

      for (const pump of period.pumps) {
        textCell(ws, row, 2, pump.label, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
        numCell(ws, row, 3, pump.opening, dataStyle(), NUM_FMT)
        numCell(ws, row, 4, pump.closing, dataStyle(), NUM_FMT)
        formulaYellow(ws, row, 5, `D${row}-C${row}`, dataStyleYellow(), ACCT_FMT_PLAIN)
        numCell(ws, row, 6, period.price, dataStyle(), 'General')
        formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow(), ACCT_FMT_PLAIN)
        row++
        rowsUsed++
      }
    }
    // Fill remaining pump rows with formulas for future entries
    for (let i = rowsUsed; i < pumpAlloc; i++) {
      formulaYellow(ws, row, 5, `D${row}-C${row}`, dataStyleYellow(), ACCT_FMT_PLAIN)
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow(), ACCT_FMT_PLAIN)
      row++
    }

    ftRefs.lastDataRow = row - 1

    // Blank spacer row
    row++

    // A = Total Sales (yellow across all cols B-G)
    ftRefs.totalARow = row
    textCell(ws, row, 2, 'A', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    textCell(ws, row, 3, `Total ${ft} sales for the period`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `SUM(E${ftRefs.firstDataRow}:E${ftRefs.lastDataRow})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `SUM(G${ftRefs.firstDataRow}:G${ftRefs.lastDataRow})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Blank spacer
    row++

    // B = Less Pour Back (first row has label + data, rest are detail rows)
    ftRefs.pourBackStart = row
    const pbDefaults = DEFAULT_POURBACK_NAMES[ft] || []
    const pourBackGroups = summary.consumption?.pourBackByPrice || []
    const pourBackAlloc = Math.max(alloc.pourBackRows, pourBackGroups.length + 1, pbDefaults.length + 1)
    textCell(ws, row, 2, ' B', { font: RED_FONT, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    textCell(ws, row, 3, `Less Pourback on ${ft} for the Period`, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())

    if (pourBackGroups.length > 0) {
      numCell(ws, row, 5, pourBackGroups[0]?.totalQty || 0, dataStyle())
      numCell(ws, row, 6, pourBackGroups[0]?.price || 0, dataStyle())
      row++
      for (let pi = 1; pi < pourBackGroups.length; pi++) {
        const g = pourBackGroups[pi]
        textCell(ws, row, 3, g.name || '', dataStyle('left'))
        numCell(ws, row, 5, g.totalQty, dataStyle())
        numCell(ws, row, 6, g.price, dataStyle())
        formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
        row++
      }
    } else {
      row++
    }
    // Fill remaining pour back rows with default names
    const pourBackWritten = Math.max(pourBackGroups.length, 1)
    for (let i = pourBackWritten; i < pourBackAlloc; i++) {
      const defName = pbDefaults[i - 1]
      if (defName) textCell(ws, row, 3, defName, dataStyle('left'))
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
      row++
    }
    ftRefs.pourBackEnd = row - 1

    // C=A-B = Net Sales (yellow across all cols B-G)
    ftRefs.netRow = row
    textCell(ws, row, 2, 'C=A-B', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    textCell(ws, row, 3, `Net ${ft} sales for the period`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `E${ftRefs.totalARow}-SUM(E${ftRefs.pourBackStart}:E${ftRefs.pourBackEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `G${ftRefs.totalARow}-SUM(G${ftRefs.pourBackStart}:G${ftRefs.pourBackEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Blank spacer
    row++

    // Less Consumption header
    textCell(ws, row, 3, `Less Consumption on ${ft}`, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    row++

    // Consumption detail rows — merge actual data with default account names
    ftRefs.consumeStart = row
    const csDefaults = DEFAULT_CONSUME_NAMES[ft] || []
    const consumedGroups = summary.consumption?.consumedByPrice || []
    const consumeAlloc = Math.max(alloc.consumeRows, consumedGroups.length, csDefaults.length)

    // Write actual consumption data first
    for (const group of consumedGroups) {
      textCell(ws, row, 3, group.name || '', dataStyle('left'))
      numCell(ws, row, 5, group.totalQty, dataStyle())
      numCell(ws, row, 6, group.price, dataStyle())
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
      row++
    }
    // Fill remaining consumption rows with default names by position
    for (let i = consumedGroups.length; i < consumeAlloc; i++) {
      const defName = i < csDefaults.length ? csDefaults[i] : null
      if (defName) textCell(ws, row, 3, defName, dataStyle('left'))
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
      row++
    }
    ftRefs.consumeEnd = row - 1

    // D = Total Consumption (yellow across all cols B-G)
    ftRefs.totalDRow = row
    textCell(ws, row, 2, 'D', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    textCell(ws, row, 3, `Total Consumption of ${ft} for the Period`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `SUM(E${ftRefs.consumeStart}:E${ftRefs.consumeEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `SUM(G${ftRefs.consumeStart}:G${ftRefs.consumeEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Blank spacer
    row++

    // E=C-D = Expected Sales (yellow across all cols B-G)
    ftRefs.expectedRow = row
    textCell(ws, row, 2, 'E=C-D', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    textCell(ws, row, 3, `Expected ${ft} Sales for the period`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left' } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `E${ftRefs.netRow}-E${ftRefs.totalDRow}`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `G${ftRefs.netRow}-G${ftRefs.totalDRow}`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Spacer rows before next fuel type
    row += 3
  }

  // Fill fuel section grid with borders (stops before reconciliation)
  fillGrid(ws, 7, row - 1, 2, 7, FONT)

  // ─── Cash/Lodgement Reconciliation ───
  // Reference pattern: data rows have ONLY medium vertical edges (L:medium on B, R:medium on G).
  // No thin borders on interior cells. Label in B overflows across empty C-F.
  const reconRow = (r, text, formula) => {
    textCell(ws, r, 2, text, { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
    formulaYellow(ws, r, 7, formula, { font: FONT_BOLD, fill: YELLOW_FILL, border: { right: { style: 'medium' } }, alignment: { horizontal: 'center' } })
  }
  const reconSpacer = (r) => {
    ws.getRow(r).getCell(2).border = { left: { style: 'medium' } }
    ws.getRow(r).getCell(7).border = { right: { style: 'medium' } }
    ws.getRow(r).getCell(2).font = FONT
    ws.getRow(r).getCell(7).font = FONT
  }

  refs.salesReconcRow = row

  // Top border row (empty row with T:medium across B-G)
  for (let c = 2; c <= 7; c++) {
    const cell = ws.getRow(row).getCell(c)
    cell.border = { top: { style: 'medium' }, left: c === 2 ? { style: 'medium' } : undefined, right: c === 7 ? { style: 'medium' } : undefined }
    cell.font = FONT
  }
  row++

  // Title row — B:medium across all, L:medium on B, R:medium on G
  textCell(ws, row, 2, `SALES/LODGEMENT RECONCIALATION ${fmtDateDisplay(startDate)}-${fmtDateDisplay(endDate)}`, { font: FONT_BOLD, border: { bottom: { style: 'medium' }, left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
  for (let c = 3; c <= 6; c++) {
    ws.getRow(row).getCell(c).border = { bottom: { style: 'medium' } }
    ws.getRow(row).getCell(c).font = FONT
  }
  ws.getRow(row).getCell(7).border = { bottom: { style: 'medium' }, right: { style: 'medium' } }
  ws.getRow(row).getCell(7).font = FONT
  row++

  reconSpacer(row)
  row++

  // Expected Sales from Products
  const expectedFormulaParts = fuelTypes.filter(ft => refs.sales[ft]).map(ft => `G${refs.sales[ft].expectedRow}`)
  const expectedFormula = expectedFormulaParts.length > 0 ? expectedFormulaParts.join('+') : '0'
  refs.expectedSalesRow = row
  reconRow(row, 'Expected Sales from Products for the Period ', expectedFormula)
  row++

  reconSpacer(row)
  row++

  // Less expenses
  refs.expensesRow = row
  reconRow(row, 'Less expenses for the Period(Approved)', "'9.Expenses for the Month'!E38")
  row++

  reconSpacer(row)
  row++

  // Net Expected Sales
  refs.netExpectedRow = row
  reconRow(row, 'Net Expected Sales for the Period', `G${refs.expectedSalesRow}-G${refs.expensesRow}`)
  row++

  reconSpacer(row)
  row++

  // Total Lodgement
  refs.totalLodgementRow = row
  reconRow(row, 'Total lodgement for the Period', `'4.Lodgement Sheet'!T${refs.lodgementTotalRow || 172}`)
  row++

  reconSpacer(row)
  row++

  // Total POS
  reconRow(row, 'Total POS for the Period', `'4.Lodgement Sheet'!Q${refs.lodgementTotalRow || 172}`)
  refs.totalPOSRow = row
  row++

  reconSpacer(row)
  row++

  // Opening Balance of Debit/Credit customers
  reconRow(row, 'Opening Balance of Debit/Credit customers', "'Customers'' Ledger'!C43")
  refs.openingBalRow = row
  row++

  reconSpacer(row)
  row++

  // Closing Balance of Debit/Credit customers
  reconRow(row, 'Closing Balance of Debit/Credit customers', "'Customers'' Ledger'!J43")
  refs.closingBalRow = row
  row++

  reconSpacer(row)
  row++

  // Overage/Shortage — G cell gets T:thin|B:double (double underline)
  textCell(ws, row, 2, 'Overage/Shortage', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
  formulaYellow(ws, row, 7, `(G${refs.totalLodgementRow}+G${refs.totalPOSRow}+G${refs.openingBalRow}-G${refs.closingBalRow})-G${refs.netExpectedRow}`, { font: FONT_BOLD, fill: YELLOW_FILL, border: { top: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'medium' } }, alignment: { horizontal: 'center' } })
  row++

  // Bottom border row (B:medium across B-G)
  for (let c = 2; c <= 7; c++) {
    const cell = ws.getRow(row).getCell(c)
    cell.border = { bottom: { style: 'medium' }, left: c === 2 ? { style: 'medium' } : undefined, right: c === 7 ? { style: 'medium' } : undefined }
    cell.font = FONT
  }
  row++

  unlockNonFormulaCells(ws)
}

// ─── 3. Stock Position ───────────────────────────────────────

function writeStockPosition(wb, report, stationName, startDate, endDate, refs) {
  const ws = wb.addWorksheet('3.Stock Position', { properties: { tabColor: { argb: 'FFFFFF00' }, defaultRowHeight: 15.75 } })
  ws.views = [{ style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, scale: 38, printArea: 'B2:E86', margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } }
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return

  // Column widths matching reference
  ws.getColumn(1).width = 9.29
  ws.getColumn(2).width = 6.29
  ws.getColumn(3).width = 73
  ws.getColumn(4).width = 31.29
  ws.getColumn(5).width = 9.29
  ws.getColumn(6).width = 9.29
  ws.getColumn(7).width = 9.29
  ws.getColumn(8).width = 9.29
  ws.getColumn(9).width = 9.29
  ws.getColumn(10).width = 13.29

  // Row 2: Audit report title
  textCell(ws, 2, 3, `AUDIT REPORT FOR :  ${stationName || ''} STATION`, { font: FONT_12_BOLD, border: {}, alignment: { horizontal: 'left' } })
  ws.getRow(2).height = 18.75

  // Row 3: Stock position period
  textCell(ws, 3, 3, `STOCK POSITION FOR THE PERIOD (${fmtDateDisplay(startDate)}- ${fmtDateDisplay(endDate)})`, { font: FONT_12_BOLD, border: {}, alignment: { horizontal: 'left' } })
  ws.getRow(3).height = 18.75

  refs.stock = {}

  // Each fuel type section in the reference is spaced with blank rows between items
  const fuelSheetMap = {
    PMS: { openCol: 'C', recCol: 'F', prodExpCol: 'D', prodActCol: 'F', dispRef: null },
    AGO: { openCol: 'I', recCol: 'L', prodExpCol: 'I', prodActCol: 'K', dispRef: null },
    DPK: { openCol: 'O', recCol: 'R', prodExpCol: 'N', prodActCol: 'P', dispRef: null },
  }

  let row = 6

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const t = data.totals
    const fMap = fuelSheetMap[ft] || {}

    refs.stock[ft] = { sectionStart: row }

    // Border styles: C gets L:medium|R:thin, D gets L:thin|R:medium (matching reference)
    const borderC = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } }
    const borderD = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } }
    const stockLabelStyle = { font: FONT_BOLD, border: borderC, alignment: { horizontal: 'left' } }
    const stockValueStyle = { font: FONT_BOLD, border: borderD, alignment: { horizontal: 'center' } }
    const stockDataStyle = { font: FONT, border: borderD, alignment: { horizontal: 'center' } }

    // Helper: apply medium vertical edges on a spacer row (no horizontal borders)
    const spacerEdges = (r) => {
      ws.getRow(r).getCell(3).border = { left: { style: 'medium' } }
      ws.getRow(r).getCell(4).border = { right: { style: 'medium' } }
      ws.getRow(r).getCell(3).font = FONT
      ws.getRow(r).getCell(4).font = FONT
    }

    // Separator row above section header: medium top+bottom on C and D
    ws.getRow(row).getCell(3).border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } }
    ws.getRow(row).getCell(4).border = { top: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } }
    ws.getRow(row).getCell(3).font = FONT
    ws.getRow(row).getCell(4).font = FONT
    row++

    // Section header: no top/bottom borders, only medium vertical edges
    textCell(ws, row, 3, `${ft} STOCK POSITION`, { font: FONT_12_BOLD, border: { left: { style: 'medium' }, right: { style: 'thin' } }, alignment: { horizontal: 'left' } })
    textCell(ws, row, 4, "Per Manager's Computation", { font: FONT_12_BOLD, border: { left: { style: 'thin' }, right: { style: 'medium' } }, alignment: { horizontal: 'left' } })
    row++

    // OPENING STOCK
    textCell(ws, row, 3, `OPENING STOCK (${fmtDateDisplay(startDate)})`, stockLabelStyle)
    if (fMap.openCol) {
      formulaCell(ws, row, 4, `'10.Record of Stock Position'!${fMap.openCol}8`, stockDataStyle)
    } else {
      numCell(ws, row, 4, t.opening, stockDataStyle)
    }
    row++

    spacerEdges(row)
    row++

    // SUPPLIES DURING THE PERIOD (NUM_FMT per reference)
    textCell(ws, row, 3, 'SUPPLIES DURING THE PERIOD ', stockLabelStyle)
    if (fMap.prodActCol) {
      formulaCell(ws, row, 4, `'8.Product Received'!${fMap.prodActCol}52`, stockDataStyle, NUM_FMT)
    } else {
      numCell(ws, row, 4, t.supply, stockDataStyle, NUM_FMT)
    }
    row++

    spacerEdges(row)
    row++

    // STOCK AVAILABLE FOR SALE = OPENING + SUPPLY
    const openRow = row - 4
    const supplyRow = row - 2
    textCell(ws, row, 3, 'STOCK AVAILABLE FOR SALE', stockLabelStyle)
    formulaCell(ws, row, 4, `+D${openRow}+D${supplyRow}`, stockDataStyle)
    const stockAvailRow = row
    row++

    spacerEdges(row)
    row++

    // CLOSING STOCK
    textCell(ws, row, 3, `CLOSING STOCK (${fmtDateDisplay(endDate)})`, stockLabelStyle)
    if (fMap.recCol) {
      formulaCell(ws, row, 4, `'10.Record of Stock Position'!${fMap.recCol}40`, stockValueStyle)
    } else {
      numCell(ws, row, 4, t.closing, stockValueStyle)
    }
    const closingRow = row
    row++

    spacerEdges(row)
    row++

    // QUANTITY SOLD = AVAILABLE - CLOSING (NUM_FMT per reference)
    textCell(ws, row, 3, 'QUANTITY SOLD', stockLabelStyle)
    formulaCell(ws, row, 4, `D${stockAvailRow}-D${closingRow}`, stockValueStyle, NUM_FMT)
    const qtySoldRow = row
    row++

    spacerEdges(row)
    row++

    // QUANTITY DISPENSED
    textCell(ws, row, 3, 'QUANTITY DISPENSED ', stockLabelStyle)
    const salesNetRef = refs.sales[ft]?.netRow
    if (salesNetRef) {
      formulaCell(ws, row, 4, `'2. Sales>>Cash Position'!E${salesNetRef}`, stockValueStyle)
    } else {
      numCell(ws, row, 4, t.dispensed, stockValueStyle)
    }
    const dispRow = row
    row++

    spacerEdges(row)
    row++

    // OVERAGE/(SHORTAGE) — regular data-style borders (ACCT_PAREN per reference)
    textCell(ws, row, 3, 'OVERAGE/(SHORTAGE)', stockLabelStyle)
    formulaCell(ws, row, 4, `D${dispRow}-D${qtySoldRow}`, stockValueStyle, ACCT_PAREN)
    row++

    // Bottom of table: T:thin|B:medium
    ws.getRow(row).getCell(3).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } }
    ws.getRow(row).getCell(4).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } }
    ws.getRow(row).getCell(3).font = FONT
    ws.getRow(row).getCell(4).font = FONT
    row++

    // 2 spacer rows with just vertical edges (gap between table and litres section)
    for (let s = 0; s < 2; s++) {
      spacerEdges(row)
      row++
    }

    // EXPECTED LITRES — only medium vertical edges (no thin borders)
    textCell(ws, row, 3, 'EXPECTED LITRES', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
    if (fMap.prodExpCol) {
      formulaCell(ws, row, 4, `'8.Product Received'!${fMap.prodExpCol}52`, { font: FONT, border: { right: { style: 'medium' } }, alignment: { horizontal: 'center' } }, NUM_FMT)
    } else {
      numCell(ws, row, 4, t.expectedLitres, { font: FONT, border: { right: { style: 'medium' } }, alignment: { horizontal: 'center' } }, NUM_FMT)
    }
    const expLitresRow = row
    row++

    spacerEdges(row)
    row++

    // ACTUAL LITRES RECEIVED — only medium vertical edges
    textCell(ws, row, 3, 'ACTUAL LITRES RECEIVED', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
    if (fMap.prodActCol) {
      formulaCell(ws, row, 4, `'8.Product Received'!${fMap.prodActCol}52`, { font: FONT, border: { right: { style: 'medium' } }, alignment: { horizontal: 'center' } })
    } else {
      numCell(ws, row, 4, t.actualLitresReceived, { font: FONT, border: { right: { style: 'medium' } }, alignment: { horizontal: 'center' } })
    }
    const actLitresRow = row
    row++

    spacerEdges(row)
    row++

    // OVERAGE/(SHORTAGE) - TRUCK DRIVER: C gets only L:medium, D gets T:thin|B:double|R:medium
    textCell(ws, row, 3, 'OVERAGE/(SHORTAGE) - TRUCK DRIVER', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
    formulaCell(ws, row, 4, `D${actLitresRow}-D${expLitresRow}`, { font: FONT_BOLD, border: { top: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'medium' } }, alignment: { horizontal: 'center' } })
    row++

    // Extra spacer before next fuel section
    for (let s = 0; s < 5; s++) {
      spacerEdges(row)
      row++
    }
  }

  unlockNonFormulaCells(ws)
}

// ─── 4. Lodgement Sheet ─────────────────────────────────────

function writeLodgement(wb, report, stationName, startDate, endDate, refs) {
  const ws = wb.addWorksheet('4.Lodgement Sheet')
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 9, topLeftCell: 'E10', style: 'pageBreakPreview', zoomScale: 85, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 22, printArea: 'A1:Z175' }
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })
  const { lodgementSheet } = report
  if (!lodgementSheet) return

  const { rows, banks, totals } = lodgementSheet
  const posBanks = banks.filter(b => b.lodgement_type === 'pos')
  const transferBanks = banks.filter(b => b.lodgement_type === 'transfer')
  const displayBanks = banks.filter(b => b.lodgement_type === 'pos' || b.lodgement_type === 'transfer')

  // Reference has 26 columns with spacer columns at D(4), F(6), H(8)
  // Layout: A=S/N, B=Sales Date, C=Total Sales, D=spacer, E=Cash Sales, F=spacer, G=Credit Sales, H=spacer
  // I..P = Bank columns (Analysis of POS by Banks)
  // Q = Total POS, R = Expenses, S = Expected Lodgement, T = Actual Lodgement
  // U = Teller No, V = Lodgement Date, W-Z = Area Managers Comment

  // Fixed column widths matching reference
  ws.getColumn(1).width = 6.71   // A
  ws.getColumn(2).width = 18.43  // B - Sales Date
  ws.getColumn(3).width = 17.43  // C - Total Sales
  ws.getColumn(4).width = 4.29   // D - spacer
  ws.getColumn(5).width = 14.57  // E - Cash Sales
  ws.getColumn(6).width = 3.29   // F - spacer
  ws.getColumn(7).width = 14.29  // G - Credit Sales
  ws.getColumn(8).width = 3.00   // H - spacer

  // Bank columns I onwards — dynamic based on banks
  const bankStartCol = 9 // I
  const bankCols = Math.max(displayBanks.length, 8) // At least 8 bank columns like reference (cols I-P)
  // Reference bank column widths (I=15.29, J=13.43, K=13.43, L=14.71, M=14.71, N=16.71, O=17.71, P=16.57)
  const refBankWidths = [15.29, 13.43, 13.43, 14.71, 14.71, 16.71, 17.71, 16.57]
  for (let i = 0; i < bankCols; i++) {
    ws.getColumn(bankStartCol + i).width = refBankWidths[i] || 14.71
  }
  const qCol = bankStartCol + bankCols  // Q = Total POS
  const rCol = qCol + 1                  // R = Expenses
  const sCol = rCol + 1                  // S = Expected Lodgement
  const tCol = sCol + 1                  // T = Actual Lodgement
  const uCol = tCol + 1                  // U = Teller No
  const vCol = uCol + 1                  // V = Lodgement Date
  const wCol = vCol + 1                  // W-Z = Area Managers Comment

  ws.getColumn(qCol).width = 16.71
  ws.getColumn(rCol).width = 12.29
  ws.getColumn(sCol).width = 24.43
  ws.getColumn(tCol).width = 22.29
  ws.getColumn(uCol).width = 11.29
  ws.getColumn(vCol).width = 19.71
  if (wCol <= 26) ws.getColumn(wCol).width = 3.57
  if (wCol + 1 <= 26) ws.getColumn(wCol + 1).width = 9.29
  if (wCol + 2 <= 26) ws.getColumn(wCol + 2).width = 9.29
  if (wCol + 3 <= 26) ws.getColumn(wCol + 3).width = 9.29

  const totalCols = wCol + 3

  // Row 2: Station info
  textCell(ws, 2, 2, 'Name of Station', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  textCell(ws, 2, 3, `${stationName || ''} BRANCH`, { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })

  // Row 3: Date of Preparation
  textCell(ws, 3, 2, 'Date of Preparation', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })

  // Row 4: For
  textCell(ws, 4, 2, 'For>>', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  textCell(ws, 4, 3, 'Internal Audit', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  ws.getRow(4).height = 14.25

  // Row 8: Main headers
  const r8 = 8
  textCell(ws, r8, 2, 'SALES DATE', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, 3, 'TOTAL SALES', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, 5, 'CASH SALES', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, 7, 'CREDIT SALES', hdrStyle(FONT_10_BOLD))

  // Analysis of POS by Banks — merged across bank columns
  textCell(ws, r8, bankStartCol, 'ANALYSIS OF POS BY BANKS', hdrStyle(FONT_10_BOLD))
  if (bankCols > 1) ws.mergeCells(r8, bankStartCol, r8, bankStartCol + bankCols - 1)

  textCell(ws, r8, qCol, 'P.O.S', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, rCol, 'EXPENSES', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, sCol, 'EXPECTED LODGEMENT', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, tCol, 'ACTUAL LODGEMENT', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, uCol, 'TELLER NO', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, vCol, 'LODGEMENT DATE', hdrStyle(FONT_10_BOLD))
  textCell(ws, r8, wCol, 'AREA MANAGERS COMMENT', hdrStyle(FONT_10_BOLD))
  if (wCol + 3 <= 30) ws.mergeCells(r8, wCol, r8, wCol + 3)

  // Row 9: Bank sub-headers
  for (let i = 0; i < displayBanks.length; i++) {
    const label = displayBanks[i].bank_name + (displayBanks[i].lodgement_type === 'transfer' ? ' (T)' : '')
    textCell(ws, 9, bankStartCol + i, label, hdrStyle(FONT_10_BOLD))
  }
  textCell(ws, 9, qCol, 'Total POS', hdrStyle(FONT_10_BOLD))

  // Data rows starting at row 11 (matching reference)
  const dataStartRow = 11
  let row = dataStartRow

  const visibleRows = rows.filter(r => r.hasData)
  const sumBanks = (amounts, list) => list.reduce((s, b) => s + (amounts[b.id] || 0), 0)

  // Write each day with 3 rows: POS row, E-BILL row, blank row (matching reference pattern)
  for (const r of visibleRows) {
    const tPOS = sumBanks(r.bankAmounts, posBanks)
    const tTransfer = sumBanks(r.bankAmounts, transferBanks)

    // Row 1: Date + Cash Sales + Bank amounts + POS total + Expected
    dateCell(ws, row, 2, r.date, dataStyle('left', FONT_10))

    // C = E + G + Q (Total Sales formula) — yellow fill
    const cFormula = `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`
    formulaYellow(ws, row, 3, cFormula, dataStyleYellow('center', FONT_10))

    numCell(ws, row, 5, r.totalSales - tPOS - tTransfer, dataStyle('center', FONT_10))

    // Bank amounts
    for (let i = 0; i < displayBanks.length; i++) {
      numCell(ws, row, bankStartCol + i, r.bankAmounts[displayBanks[i].id] || 0, dataStyle('center', FONT_10))
    }

    // Q = sum of bank columns (POS total formula) — yellow fill
    const bankRange = `${colLetter(bankStartCol)}${row}:${colLetter(bankStartCol + bankCols - 1)}${row}`
    formulaYellow(ws, row, qCol, `SUM(${bankRange})`, dataStyleYellow('center', FONT_10))

    // S = E - R (Expected Lodgement formula) — yellow fill
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dataStyleYellow('center', FONT_10))

    textCell(ws, row, uCol, 'POS', dataStyle('left', FONT_10))
    dateCell(ws, row, vCol, r.date, dataStyle('left', FONT_10))
    row++

    // Row 2: Actual lodgement + E-BILL — C, Q, S yellow
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dataStyleYellow('center', FONT_10))
    formulaYellow(ws, row, qCol, `SUM(${colLetter(bankStartCol)}${row}:${colLetter(bankStartCol + bankCols - 1)}${row})`, dataStyleYellow('center', FONT_10))
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dataStyleYellow('center', FONT_10))
    numCell(ws, row, tCol, r.actual || r.totalSales, dataStyle('center', FONT_10))
    textCell(ws, row, uCol, 'E-BILL', dataStyle('left', FONT_10))
    row++

    // Row 3: Blank spacer with formulas — C, Q, S yellow
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dataStyleYellow('center', FONT_10))
    formulaYellow(ws, row, qCol, `SUM(${colLetter(bankStartCol)}${row}:${colLetter(bankStartCol + bankCols - 1)}${row})`, dataStyleYellow('center', FONT_10))
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dataStyleYellow('center', FONT_10))
    row++
  }

  // Fill remaining rows up to 171 with blank formula rows (template has 161 data rows) — C, Q, S yellow
  const maxDataRow = 171
  while (row <= maxDataRow) {
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dataStyleYellow('center', FONT_10))
    formulaYellow(ws, row, qCol, `SUM(${colLetter(bankStartCol)}${row}:${colLetter(bankStartCol + bankCols - 1)}${row})`, dataStyleYellow('center', FONT_10))
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dataStyleYellow('center', FONT_10))
    row++
  }

  // Totals row (172 in reference)
  const totRow = 172
  refs.lodgementTotalRow = totRow
  textCell(ws, totRow, 2, 'TOTAL AMOUNT', { font: FONT_10_BOLD, border: BORDER_TOTAL, alignment: { horizontal: 'left' } })
  formulaCell(ws, totRow, 3, `SUM(C${dataStartRow}:C${totRow - 1})`, totalStyle('center', FONT_10_BOLD))
  formulaCell(ws, totRow, 5, `SUM(E${dataStartRow}:E${totRow - 1})`, totalStyle('center', FONT_10_BOLD))
  formulaCell(ws, totRow, 7, `SUM(G${dataStartRow}:G${totRow - 1})`, totalStyle('center', FONT_10_BOLD))

  for (let i = 0; i < bankCols; i++) {
    const cl = colLetter(bankStartCol + i)
    formulaCell(ws, totRow, bankStartCol + i, `SUM(${cl}${dataStartRow}:${cl}${totRow - 1})`, totalStyle('center', FONT_10_BOLD))
  }

  formulaCell(ws, totRow, qCol, `SUM(${colLetter(qCol)}${dataStartRow}:${colLetter(qCol)}${totRow - 1})`, totalStyle('center', FONT_10_BOLD))
  formulaCell(ws, totRow, rCol, `SUM(${colLetter(rCol)}${dataStartRow}:${colLetter(rCol)}${totRow - 1})`, totalStyle('center', FONT_10_BOLD))
  formulaCell(ws, totRow, sCol, `SUM(${colLetter(sCol)}${dataStartRow}:${colLetter(sCol)}${totRow - 1})`, totalStyle('center', FONT_10_BOLD))
  formulaCell(ws, totRow, tCol, `SUM(${colLetter(tCol)}${dataStartRow}:${colLetter(tCol)}${totRow - 1})`, totalStyle('center', FONT_10_BOLD))

  // Fill header rows with edge borders
  fillHeaderRow(ws, r8, 2, totalCols, FONT_10_BOLD)
  fillHeaderRow(ws, 9, 2, totalCols, FONT_10_BOLD)

  // Fill data grid with borders on all empty cells
  fillGrid(ws, dataStartRow, totRow, 2, totalCols, FONT_10)

  unlockNonFormulaCells(ws)
}

// ─── 5/6/7. Consumption and Pour back ────────────────────────

function writeConsumption(wb, report, startDate, endDate, fuelType, sheetName) {
  const { consumptionReport } = report
  if (!consumptionReport) return
  const data = consumptionReport[fuelType]
  if (!data) return

  const ws = wb.addWorksheet(sheetName)
  // Views/page setup per fuel type
  const consumeViews = {
    PMS: { ySplit: 5, topLeftCell: 'A6', zoomScale: 100, scale: 44, printArea: 'A1:N39' },
    AGO: { ySplit: 5, topLeftCell: 'A6', zoomScale: 87, scale: 50, printArea: 'A1:I39' },
    DPK: { ySplit: 6, topLeftCell: 'A7', zoomScale: 100, scale: 61, printArea: 'A1:I39' },
  }
  const cv = consumeViews[fuelType] || consumeViews.PMS
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: cv.ySplit, topLeftCell: cv.topLeftCell, style: 'pageBreakPreview', zoomScale: cv.zoomScale, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: cv.scale, printArea: cv.printArea }
  const { customers, rows: dataRows, totals } = data

  // Column widths — per fuel type from reference (col A intentionally has no width)
  const consumeWidths = {
    PMS: { 2: 11.43, 3: 15.29, 4: 12.71, 5: 16.71, 6: 15.57, 7: 19.71, 8: 13.29, 10: 12.71, 11: 12.71, 13: 11 },
    AGO: { 2: 14, 3: 16.71, 4: 17.71, 5: 17.29, 6: 32.29, 7: 23, 8: 13.57, 9: 18.29 },
    DPK: { 2: 18.71, 4: 13.57, 5: 17.29, 6: 30.43, 7: 21.57, 8: 11 },
  }
  const cw = consumeWidths[fuelType] || consumeWidths.PMS
  for (const [col, w] of Object.entries(cw)) {
    ws.getColumn(Number(col)).width = w
  }
  // Dynamic customer columns get reference-based widths or fallback
  const lastCustCol = 4 + customers.length
  for (let i = 0; i < customers.length; i++) {
    const col = 4 + i
    if (!cw[col]) ws.getColumn(col).width = Math.max(customers[i].name.length * 1.2, 12)
  }
  if (!cw[lastCustCol]) ws.getColumn(lastCustCol).width = 13.29 // Pour back

  // Title row at row 2 (PMS) or row 2-3 depending on fuel
  const titleRow = fuelType === 'DPK' ? 3 : 2
  textCell(ws, titleRow, 3, `${fuelType} CONSUMPTION  AT DIFFERENT PRICES`, { font: FONT_10_BOLD, border: {}, alignment: { horizontal: 'left' } })

  // Headers at row 5 (PMS/AGO) or row 6 (DPK)
  const hdrRow = fuelType === 'DPK' ? 6 : 5
  textCell(ws, hdrRow, 2, 'Date', hdrStyle(FONT_10_BOLD))
  textCell(ws, hdrRow, 3, 'Rate (N)', hdrStyle(FONT_10_BOLD))
  for (let i = 0; i < customers.length; i++) {
    textCell(ws, hdrRow, 4 + i, customers[i].name, hdrStyle(FONT_10_BOLD))
  }
  textCell(ws, hdrRow, 4 + customers.length, 'Pour back', hdrStyle(FONT_10_BOLD))

  if (fuelType === 'AGO') {
    ws.getRow(hdrRow).height = 39.75
  }

  // Data rows — rate and customer qty use 'General' per reference
  let row = hdrRow + 1
  for (const r of dataRows) {
    dateCell(ws, row, 2, r.date, dataStyle('left', FONT_10))
    numCell(ws, row, 3, r.rate, dataStyle('center', FONT_10), 'General')
    for (let i = 0; i < customers.length; i++) {
      numCell(ws, row, 4 + i, r.customerQtys[customers[i].id] || 0, dataStyle('center', FONT_10), 'General')
    }
    numCell(ws, row, 4 + customers.length, r.pourBack || 0, dataStyle('center', FONT_10), 'General')
    row++
  }

  // Fill remaining template rows (reference has ~31 data rows)
  const templateRows = 31
  const written = dataRows.length
  for (let i = written; i < templateRows; i++) {
    row++
  }

  // Totals row
  const totRow = row
  textCell(ws, totRow, 2, 'Total', totalStyle('left', FONT_10_BOLD))
  textCell(ws, totRow, 3, '', totalStyle('center', FONT_10_BOLD))
  for (let i = 0; i < customers.length; i++) {
    numCell(ws, totRow, 4 + i, totals.customerTotals[customers[i].id] || 0, totalStyle('center', FONT_10_BOLD))
  }
  numCell(ws, totRow, 4 + customers.length, totals.pourBack || 0, totalStyle('center', FONT_10_BOLD))

  const lastCol = 4 + customers.length
  // Fill header row with edge borders
  fillHeaderRow(ws, hdrRow, 2, lastCol, FONT_10_BOLD)
  // Fill data grid with borders on all empty cells
  fillGrid(ws, hdrRow + 1, totRow, 2, lastCol, FONT_10)
}

// ─── 8. Product Received ─────────────────────────────────────

function writeProductReceived(wb, receipts, tanks, startDate, endDate, refs) {
  const ws = wb.addWorksheet('8.Product Received')
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8, topLeftCell: 'A9', style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 53, printArea: 'A1:P55' }

  const tankFuel = {}
  for (const t of (tanks || [])) tankFuel[t.id] = t.fuel_type

  const rangeReceipts = (receipts || [])
    .filter(r => (r.entryDate || '') >= startDate && (r.entryDate || '') <= endDate)
    .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  const byDate = {}
  for (const r of rangeReceipts) {
    if (!byDate[r.entryDate]) byDate[r.entryDate] = []
    byDate[r.entryDate].push(r)
  }

  // Column widths matching reference (with spacer columns)
  ws.getColumn(1).width = 9.29    // A (empty)
  ws.getColumn(2).width = 14.29   // B - Loading Date
  ws.getColumn(3).width = 14.29   // C - Receipt Date
  ws.getColumn(4).width = 11.71   // D - PMS Expected
  ws.getColumn(5).width = 1.43    // E - spacer
  ws.getColumn(6).width = 12      // F - PMS Actual
  ws.getColumn(7).width = 2.29    // G - spacer
  ws.getColumn(8).width = 8.71    // H (spacer/unused)
  ws.getColumn(9).width = 11.29   // I - AGO Expected
  ws.getColumn(10).width = 3      // J - spacer
  ws.getColumn(11).width = 11.29  // K - AGO Actual
  ws.getColumn(12).width = 0.71   // L - spacer
  ws.getColumn(13).width = 9.71   // M (spacer/unused)
  ws.getColumn(14).width = 11.43  // N - DPK Expected
  ws.getColumn(15).width = 2.71   // O - spacer
  ws.getColumn(16).width = 11.57  // P - DPK Actual

  // Row 5: Title
  textCell(ws, 5, 6, 'PRODUCT RECEIVED FOR THE MONTH', { font: FONT_BOLD, border: {}, alignment: { horizontal: 'center' } })

  // Row 7: Fuel type headers (merged across expected+spacer+actual)
  textCell(ws, 7, 2, 'LOADING ', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 3, 'RECEIPT', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 4, 'PMS', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('D7:G7')
  textCell(ws, 7, 9, 'AGO', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('I7:L7')
  textCell(ws, 7, 14, 'DPK', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('N7:P7')

  // Row 8: Sub-headers
  textCell(ws, 8, 2, 'DATE', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 3, 'DATE', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 4, 'EXPECTED', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 6, 'ACTUAL', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 9, 'EXPECTED', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 11, 'ACTUAL', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 14, 'EXPECTED', hdrStyle(FONT_10_BOLD))
  textCell(ws, 8, 16, 'ACTUAL', hdrStyle(FONT_10_BOLD))

  // Data rows starting at row 9
  let row = 9
  const dates = Object.keys(byDate).sort()
  for (const date of dates) {
    const entries = byDate[date]
    let pmsExp = 0, pmsAct = 0, agoExp = 0, agoAct = 0, dpkExp = 0, dpkAct = 0

    for (const e of entries) {
      const ft = tankFuel[e.tankId]
      const expected = Number(e.firstCompartment || 0) + Number(e.secondCompartment || 0) + Number(e.thirdCompartment || 0)
      const actual = Number(e.actualVolume || 0)
      if (ft === 'PMS') { pmsExp += expected; pmsAct += actual }
      else if (ft === 'AGO') { agoExp += expected; agoAct += actual }
      else if (ft === 'DPK') { dpkExp += expected; dpkAct += actual }
    }

    // Use receipt date for both loading and receipt (same data)
    dateCell(ws, row, 2, date, dataStyle('left', FONT_10))
    dateCell(ws, row, 3, date, dataStyle('left', FONT_10))
    if (pmsExp) numCell(ws, row, 4, pmsExp, dataStyle('center', FONT_10), ACCT_FMT_2)
    if (pmsAct) numCell(ws, row, 6, pmsAct, dataStyle('center', FONT_10), ACCT_FMT_2)
    if (agoExp) numCell(ws, row, 9, agoExp, dataStyle('center', FONT_10), ACCT_FMT_2)
    if (agoAct) numCell(ws, row, 11, agoAct, dataStyle('center', FONT_10), ACCT_FMT_2)
    if (dpkExp) numCell(ws, row, 14, dpkExp, dataStyle('center', FONT_10), ACCT_FMT_2)
    if (dpkAct) numCell(ws, row, 16, dpkAct, dataStyle('center', FONT_10), ACCT_FMT_2)
    row++
  }

  // Fill up to row 51 (template has rows 9-51 for data)
  while (row <= 51) row++

  // Totals row at row 52
  const totRow = 52
  refs.productReceivedTotalRow = totRow
  textCell(ws, totRow, 2, 'TOTAL', totalStyle('left', FONT_10_BOLD))
  formulaCell(ws, totRow, 4, 'SUM(D9:D51)', totalStyle('center', FONT_10_BOLD), ACCT_FMT_2)
  formulaCell(ws, totRow, 6, 'SUM(F9:F51)', totalStyle('center', FONT_10_BOLD), ACCT_FMT_2)
  formulaCell(ws, totRow, 9, 'SUM(I9:I51)', totalStyle('center', FONT_10_BOLD), ACCT_FMT_2)
  formulaCell(ws, totRow, 11, 'SUM(K9:K51)', totalStyle('center', FONT_10_BOLD), ACCT_FMT_2)
  formulaCell(ws, totRow, 14, 'SUM(N9:N51)', totalStyle('center', FONT_10_BOLD), ACCT_FMT_2)
  formulaCell(ws, totRow, 16, 'SUM(P9:P51)', totalStyle('center', FONT_10_BOLD), ACCT_FMT_2)

  // Fill header rows with edge borders
  fillHeaderRow(ws, 7, 2, 16, FONT_10_BOLD)
  fillHeaderRow(ws, 8, 2, 16, FONT_10_BOLD)
  // Fill data grid with borders on all empty cells
  fillGrid(ws, 9, totRow, 2, 16, FONT_10)

  // Yellow fill on spacer columns H (col 8) and M (col 13) for rows 7-51 per reference
  for (let r = 7; r <= 51; r++) {
    for (const col of [8, 13]) {
      const cell = ws.getRow(r).getCell(col)
      cell.fill = YELLOW_FILL
    }
  }
}

// ─── 9. Expenses for the Month ───────────────────────────────

function writeExpenses(wb, expenses) {
  const ws = wb.addWorksheet('9.Expenses for the Month')
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 6, topLeftCell: 'A7', style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 62, printArea: 'A1:G40' }

  ws.getColumn(1).width = 9.29
  ws.getColumn(2).width = 12.57
  ws.getColumn(3).width = 16.29
  ws.getColumn(4).width = 44
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 17.71

  // Row 4: Title
  textCell(ws, 4, 4, 'EXPENSES FOR THE MONTH', { font: FONT_10_BOLD, border: {}, alignment: { horizontal: 'center' } })

  // Row 6: Headers
  textCell(ws, 6, 2, 'S/N', hdrStyle(FONT_10_BOLD, BORDER_HDR_LR))
  textCell(ws, 6, 3, 'DATE', hdrStyle(FONT_10_BOLD, BORDER_HDR_LR))
  textCell(ws, 6, 4, 'PURPOSE  OF EXPENSES ', hdrStyle(FONT_10_BOLD, BORDER_HDR_LR))
  textCell(ws, 6, 5, ' AMOUNT (=N=)', hdrStyle(FONT_10_BOLD, BORDER_HDR_LR))
  textCell(ws, 6, 6, 'APPROVED BY:', hdrStyle(FONT_10_BOLD, BORDER_HDR_LR))

  // Data rows 7-37 (S/N 1-31)
  const expenseData = expenses || []
  for (let i = 0; i < 31; i++) {
    const r = 7 + i
    textCell(ws, r, 2, i + 1, dataStyle('center', FONT_10))
    if (expenseData[i]) {
      dateCell(ws, r, 3, expenseData[i].date, dataStyle('left', FONT_10))
      textCell(ws, r, 4, expenseData[i].purpose || '', dataStyle('left', FONT_10))
      numCell(ws, r, 5, expenseData[i].amount, dataStyle('center', FONT_10), ACCT_PAREN)
    } else {
      textCell(ws, r, 3, '', dataStyle('left', FONT_10))
      textCell(ws, r, 4, '', dataStyle('left', FONT_10))
      textCell(ws, r, 5, '', dataStyle('center', FONT_10))
    }
    textCell(ws, r, 6, expenseData[i]?.approvedBy || '', dataStyle('left', FONT_10))
  }

  // Totals row 38
  textCell(ws, 38, 3, 'Total', totalStyle('left', FONT_10_BOLD))
  formulaCell(ws, 38, 5, 'SUM(E7:E37)', totalStyle('center', FONT_10_BOLD), ACCT_PAREN)

  // Fill header row with edge borders
  fillHeaderRow(ws, 6, 2, 6, FONT_10_BOLD)
  // Fill data grid with borders on all empty cells
  fillGrid(ws, 7, 38, 2, 6, FONT_10)
}

// ─── 10. Record of Stock Position (combined) ─────────────────

function writeRecordOfStock(wb, report, refs) {
  const ws = wb.addWorksheet('10.Record of Stock Position', { properties: { tabColor: { argb: 'FFFFFF00' } } })
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 7, topLeftCell: 'B8', style: 'pageBreakPreview', zoomScale: 89, zoomScaleNormal: 89, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 27, printArea: 'A1:S42' }
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return

  // Column widths matching reference — 18 columns
  // PMS: B-F, spacer G, AGO: H-L, spacer M, DPK: N-R
  ws.getColumn(1).width = 5       // A
  ws.getColumn(2).width = 12.43   // B - PMS Date
  ws.getColumn(3).width = 16      // C - PMS Opening
  ws.getColumn(4).width = 26.71   // D - PMS Supplied
  ws.getColumn(5).width = 15.71   // E - PMS Qty Sold (yellow formula)
  ws.getColumn(6).width = 19      // F - PMS Closing
  ws.getColumn(7).width = 9.29    // G - spacer
  ws.getColumn(8).width = 13.71   // H - AGO Date
  ws.getColumn(9).width = 17.57   // I - AGO Opening
  ws.getColumn(10).width = 23     // J - AGO Supplied
  ws.getColumn(11).width = 19.29  // K - AGO Qty Sold (yellow formula)
  ws.getColumn(12).width = 15.29  // L - AGO Closing
  ws.getColumn(13).width = 9.29   // M - spacer
  ws.getColumn(14).width = 17.71  // N - DPK Date
  ws.getColumn(15).width = 17     // O - DPK Opening
  ws.getColumn(16).width = 24.71  // P - DPK Supplied
  ws.getColumn(17).width = 17.29  // Q - DPK Qty Sold (yellow formula)
  ws.getColumn(18).width = 12.57  // R - DPK Closing

  // Note: ExcelJS rounds widths internally — these match the reference file within tolerance

  // Row 6: Fuel type section headers (merged)
  textCell(ws, 6, 2, 'PMS', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('B6:F6')
  textCell(ws, 6, 8, 'AGO', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('H6:L6')
  textCell(ws, 6, 14, 'DPK', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('N6:R6')

  // Row 7: Column headers for each section
  const sectionHeaders = ['Date', 'Opening Stock', 'Actual Producted Supplied', 'Quantity sold', 'Closing Stock']
  // PMS (B-F)
  for (let i = 0; i < sectionHeaders.length; i++) textCell(ws, 7, 2 + i, sectionHeaders[i], hdrStyle(FONT_10_BOLD))
  // AGO (H-L)
  for (let i = 0; i < sectionHeaders.length; i++) textCell(ws, 7, 8 + i, sectionHeaders[i], hdrStyle(FONT_10_BOLD))
  // DPK (N-R)
  for (let i = 0; i < sectionHeaders.length; i++) textCell(ws, 7, 14 + i, sectionHeaders[i], hdrStyle(FONT_10_BOLD))

  // Data rows starting at row 8
  const dataStartRow = 8
  const fuelCols = {
    PMS: { dateCol: 2, openCol: 3, supplyCol: 4, qtyCol: 5, closeCol: 6 },
    AGO: { dateCol: 8, openCol: 9, supplyCol: 10, qtyCol: 11, closeCol: 12 },
    DPK: { dateCol: 14, openCol: 15, supplyCol: 16, qtyCol: 17, closeCol: 18 },
  }

  // Find max number of data rows across fuel types
  let maxRows = 0
  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (data) {
      const visibleRows = data.rows.filter(r => r.hasData)
      maxRows = Math.max(maxRows, visibleRows.length)
    }
  }

  // Write data for each fuel type side by side
  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const cols = fuelCols[ft]
    if (!cols) continue

    const visibleRows = data.rows.filter(r => r.hasData)

    for (let i = 0; i < visibleRows.length; i++) {
      const r = dataStartRow + i
      const d = visibleRows[i]

      dateCell(ws, r, cols.dateCol, d.date, dataStyle('left', FONT_10))
      numCell(ws, r, cols.openCol, d.opening, dataStyle('center', FONT_10))
      if (d.supply) numCell(ws, r, cols.supplyCol, d.supply, dataStyle('center', FONT_10), ACCT_FMT_2)

      // Qty Sold = Opening + Supply - Closing (yellow formula)
      const oc = colLetter(cols.openCol)
      const sc = colLetter(cols.supplyCol)
      const cc = colLetter(cols.closeCol)
      formulaYellow(ws, r, cols.qtyCol, `${oc}${r}+${sc}${r}-${cc}${r}`, dataStyleYellow('center', FONT_10))

      numCell(ws, r, cols.closeCol, d.closing, dataStyle('center', FONT_10))
    }
  }

  // Fill remaining rows with formulas up to row 37 (template has ~30 data rows)
  const lastDataRow = dataStartRow + maxRows - 1
  for (let r = lastDataRow + 1; r <= 37; r++) {
    for (const ft of fuelTypes) {
      const cols = fuelCols[ft]
      if (!cols) continue
      const oc = colLetter(cols.openCol)
      const sc = colLetter(cols.supplyCol)
      const cc = colLetter(cols.closeCol)
      formulaYellow(ws, r, cols.qtyCol, `${oc}${r}+${sc}${r}-${cc}${r}`, dataStyleYellow('center', FONT_10))
    }
  }

  // Row 38: Last data row with closing stock repeated
  const r38 = 38
  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const cols = fuelCols[ft]
    if (!cols) continue
    const t = data.totals
    numCell(ws, r38, cols.openCol, t.closing, dataStyle('center', FONT_10))
    const oc = colLetter(cols.openCol)
    const sc = colLetter(cols.supplyCol)
    const cc = colLetter(cols.closeCol)
    formulaYellow(ws, r38, cols.qtyCol, `${oc}${r38}+${sc}${r38}-${cc}${r38}`, dataStyleYellow('center', FONT_10))
    numCell(ws, r38, cols.closeCol, t.closing, dataStyle('center', FONT_10))
  }

  // Row 40: Closing stock formula — IF(C38>0, F38, F37)
  for (const ft of fuelTypes) {
    const cols = fuelCols[ft]
    if (!cols) continue
    const oc = colLetter(cols.openCol)
    const cc = colLetter(cols.closeCol)
    formulaYellow(ws, 40, cols.closeCol, `IF(${oc}38>0,${cc}38,${cc}37)`, dataStyleYellow('center', FONT_10))
  }

  // Fill header rows with edge borders for each section
  // PMS (B-F), AGO (H-L), DPK (N-R)
  fillHeaderRow(ws, 6, 2, 6, FONT_10_BOLD)
  fillHeaderRow(ws, 7, 2, 6, FONT_10_BOLD)
  fillHeaderRow(ws, 6, 8, 12, FONT_10_BOLD)
  fillHeaderRow(ws, 7, 8, 12, FONT_10_BOLD)
  fillHeaderRow(ws, 6, 14, 18, FONT_10_BOLD)
  fillHeaderRow(ws, 7, 14, 18, FONT_10_BOLD)

  // Fill data grids per section
  fillGrid(ws, 8, 40, 2, 6, FONT_10)
  fillGrid(ws, 8, 40, 8, 12, FONT_10)
  fillGrid(ws, 8, 40, 14, 18, FONT_10)

  unlockNonFormulaCells(ws)
}

// ─── Customers' Ledger ───────────────────────────────────────

function writeCustomersLedger(wb, customers) {
  const ws = wb.addWorksheet("Customers' Ledger", { properties: { tabColor: { argb: 'FFFFFF00' }, defaultColWidth: 3.57 } })
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2, topLeftCell: 'B3', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })

  // Column widths matching reference
  ws.getColumn(1).width = 7       // A - S/N
  ws.getColumn(2).width = 29.57   // B - Customer Name
  ws.getColumn(3).width = 16.29   // C - Opening Balance
  ws.getColumn(4).width = 2.71    // D - spacer
  ws.getColumn(5).width = 15.29   // E - Lodgement Date
  ws.getColumn(6).width = 11.43   // F - Bank
  ws.getColumn(7).width = 14.29   // G - Amount Lodged
  ws.getColumn(8).width = 3.57    // H - spacer
  ws.getColumn(9).width = 13.29   // I - Value of Product Sold
  ws.getColumn(10).width = 19.71  // J - Closing Balance (yellow formula)
  ws.getColumn(11).width = 3.57   // K-N spacers
  ws.getColumn(12).width = 3.57
  ws.getColumn(13).width = 3.57
  ws.getColumn(14).width = 3.57
  ws.getColumn(15).width = 11.29  // O

  // Row 1: Title (Arial 14 bold, merged A1:J1)
  textCell(ws, 1, 1, 'CORPORATE CUSTOMERS STATEMENT FOR THE MONTH', { font: ARIAL_TITLE, border: BORDER_MED_BOX, alignment: { horizontal: 'center' } })
  ws.mergeCells('A1:J1')
  ws.getRow(1).height = 19.15

  // Row 2: Headers (Arial 11 bold)
  const hdrSty = { font: ARIAL_BOLD, border: BORDER_HDR_LR, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } }
  textCell(ws, 2, 1, 'S/N', hdrSty)
  textCell(ws, 2, 2, "CUSTOMER'S NAME", hdrSty)
  textCell(ws, 2, 3, 'OPENING BALANCE', hdrSty)
  textCell(ws, 2, 5, 'LODGEMENT DATE ', hdrSty)
  textCell(ws, 2, 6, 'BANK', hdrSty)
  textCell(ws, 2, 7, 'AMOUNT LODGED', hdrSty)
  textCell(ws, 2, 9, 'VALUE OF PRODUCT SOLD', hdrSty)
  textCell(ws, 2, 10, 'CLOSING BALANCE ', hdrSty)
  ws.getRow(2).height = 45

  const dataSty = { font: ARIAL_FONT, border: BORDER_THIN, alignment: { horizontal: 'center' } }
  const dataStyL = { font: ARIAL_FONT, border: BORDER_THIN, alignment: { horizontal: 'left' } }

  // Data rows 3-42 (40 rows, ~7 rows per customer with S/N at first row of each group)
  // Row 3: J3 = C3+G3-I3 (first formula is unique)
  formulaYellow(ws, 3, 10, 'C3+G3-I3', { font: ARIAL_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
  textCell(ws, 3, 1, 1, dataSty)

  // Row 4: J4 has own formula (start of shared range)
  formulaYellow(ws, 4, 10, 'C4+G4-I4', { font: ARIAL_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })

  // Rows 5-42: shared formula
  for (let r = 5; r <= 42; r++) {
    formulaYellow(ws, r, 10, `C${r}+G${r}-I${r}`, { font: ARIAL_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
  }

  // S/N markers at customer boundaries (per reference: 1 at row 3, 2 at row 10, 3 at row 17, etc.)
  const customerStarts = [3, 10, 17, 24, 31, 38]
  for (let ci = 0; ci < customerStarts.length && ci < 6; ci++) {
    textCell(ws, customerStarts[ci], 1, ci + 1, dataSty)
  }

  // Fill customer data if provided
  if (customers && customers.length > 0) {
    for (let ci = 0; ci < customers.length && ci < customerStarts.length; ci++) {
      const cust = customers[ci]
      const startRow = customerStarts[ci]
      textCell(ws, startRow, 2, cust.name || '', dataStyL)
      if (cust.openingBalance) numCell(ws, startRow, 3, cust.openingBalance, dataSty, ACCT_PAREN)

      const entries = cust.entries || []
      for (let ei = 0; ei < entries.length && ei < 7; ei++) {
        const er = startRow + ei
        if (entries[ei].date) dateCell(ws, er, 5, entries[ei].date, dataStyL)
        if (entries[ei].bank) textCell(ws, er, 6, entries[ei].bank, dataStyL)
        if (entries[ei].amountLodged) numCell(ws, er, 7, entries[ei].amountLodged, dataSty, ACCT_PAREN)
        if (entries[ei].valueSold) numCell(ws, er, 9, entries[ei].valueSold, dataSty, ACCT_PAREN)
      }
    }
  }

  // Row 43: Totals
  const totSty = { font: ARIAL_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } }
  textCell(ws, 43, 2, 'TOTAL', { font: ARIAL_BOLD, border: BORDER_TOTAL, alignment: { horizontal: 'left' } })
  formulaYellow(ws, 43, 3, 'SUM(C3:C42)', totSty)
  formulaYellow(ws, 43, 7, 'SUM(G3:G42)', totSty)
  formulaYellow(ws, 43, 9, 'SUM(I3:I42)', totSty)
  formulaYellow(ws, 43, 10, 'SUM(J3:J42)', totSty)

  // Fill header row with edge borders
  fillHeaderRow(ws, 2, 1, 10, ARIAL_BOLD)
  // Fill data grid with borders on all empty cells
  fillGrid(ws, 3, 43, 1, 10, ARIAL_FONT)

  unlockNonFormulaCells(ws)
}

// ─── Castro Lubricants ───────────────────────────────────────

function writeLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate) {
  const ws = wb.addWorksheet('Castro Lubricants', { properties: { tabColor: { argb: 'FFFFFF00' } } })
  ws.views = [{ zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', scale: 100 }
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })

  // Column widths matching reference (11 columns A-K)
  ws.getColumn(1).width = 6.29   // A (empty)
  ws.getColumn(2).width = 8.71   // B - S/N
  ws.getColumn(3).width = 28     // C - Item
  ws.getColumn(4).width = 8.71   // D - Litre
  ws.getColumn(5).width = 8.71   // E - Opening Stock
  ws.getColumn(6).width = 10.43  // F - Purchase
  ws.getColumn(7).width = 11.57  // G - Sales Qty (yellow formula)
  ws.getColumn(8).width = 8.71   // H - Closing Stock
  ws.getColumn(9).width = 9.86   // I - Price
  ws.getColumn(10).width = 16.57 // J - Amount (yellow formula)
  ws.getColumn(11).width = 8.71  // K - Date

  // Row 3: Title (Calibri 14 bold, merged B3:J3)
  textCell(ws, 3, 2, `CASTRO OIL AS AT ${fmtDateDisplay(endDate)} - ${stationName || ''}`, { font: CAL_TITLE, border: BORDER_MED_BOX, alignment: { horizontal: 'center' } })
  ws.mergeCells('B3:J3')
  ws.getRow(3).height = 15.75

  // Row 4: Headers (Calibri 11 bold)
  const hdrSty = hdrStyle(CAL_BOLD)
  textCell(ws, 4, 2, 'S/N', hdrSty)
  textCell(ws, 4, 3, 'ITEM', hdrSty)
  textCell(ws, 4, 4, 'Litre', hdrSty)
  textCell(ws, 4, 5, 'OPENING STOCK ', hdrSty)
  textCell(ws, 4, 6, 'PURCHASE', hdrSty)
  textCell(ws, 4, 7, 'SALES (QUANTITY)', { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_HDR, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } })
  textCell(ws, 4, 8, 'CLOSING STOCK', hdrSty)
  textCell(ws, 4, 9, 'PRICE (N)', hdrSty)
  textCell(ws, 4, 10, 'AMOUNT', { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_HDR, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } })
  textCell(ws, 4, 11, 'Date', hdrSty)
  ws.getRow(4).height = 45.75

  if (!lubeProducts?.length) return

  const products = [...lubeProducts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const stockSorted = [...(lubeStock || [])].sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  // Data rows starting at row 5
  const dataStartRow = 5
  for (let idx = 0; idx < products.length; idx++) {
    const row = dataStartRow + idx
    const prod = products[idx]

    const prodSales = (lubeSales || []).filter(s =>
      s.productId === prod.id && s.entryDate >= startDate && s.entryDate <= endDate
    )
    const prodStock = stockSorted.filter(s => s.productId === prod.id)

    let openingStock = 0
    for (const s of prodStock) {
      if (s.entryDate <= startDate) openingStock = Number(s.stock || 0)
    }
    let closingStock = openingStock
    for (const s of prodStock) {
      if (s.entryDate <= endDate) closingStock = Number(s.stock || 0)
    }

    const purchase = prodSales.reduce((sum, s) => sum + Number(s.unitReceived || 0), 0)
    const unitPrice = Number(prod.unit_price || 0)

    textCell(ws, row, 2, idx + 1, dataStyle('center', CAL_FONT))
    textCell(ws, row, 3, prod.product_name || '', dataStyle('left', CAL_FONT))
    numCell(ws, row, 4, prod.size || 0, dataStyle('center', CAL_FONT), ACCT_FMT_2)
    if (openingStock) numCell(ws, row, 5, openingStock, dataStyle('center', CAL_FONT))
    if (purchase) numCell(ws, row, 6, purchase, dataStyle('center', CAL_FONT))

    // G = E + F - H (Sales Quantity formula, yellow)
    formulaYellow(ws, row, 7, `E${row}+F${row}-H${row}`, dataStyleYellow('center', CAL_FONT))

    if (closingStock) numCell(ws, row, 8, closingStock, dataStyle('center', CAL_FONT))
    numCell(ws, row, 9, unitPrice, dataStyle('center', CAL_FONT))

    // J = G * I (Amount formula, yellow)
    formulaYellow(ws, row, 10, `G${row}*I${row}`, dataStyleYellow('center', CAL_FONT), ACCT_FMT_2)
  }

  // Fill empty rows up to row 29 (template has 25 product rows) — yellow on G and J
  const lastProductRow = dataStartRow + products.length - 1
  for (let r = lastProductRow + 1; r <= 29; r++) {
    formulaYellow(ws, r, 7, `E${r}+F${r}-H${r}`, dataStyleYellow('center', CAL_FONT))
    formulaYellow(ws, r, 10, `G${r}*I${r}`, dataStyleYellow('center', CAL_FONT), ACCT_FMT_2)
  }

  // Row 30: Totals with SUM formulas
  const totRow = 30
  formulaCell(ws, totRow, 5, `SUM(E${dataStartRow}:E29)`, totalStyle('center', CAL_BOLD))
  formulaCell(ws, totRow, 6, `SUM(F${dataStartRow}:F29)`, totalStyle('center', CAL_BOLD))
  formulaCell(ws, totRow, 7, `SUM(G${dataStartRow}:G29)`, { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } })
  formulaCell(ws, totRow, 8, `SUM(H${dataStartRow}:H29)`, totalStyle('center', CAL_BOLD))
  textCell(ws, totRow, 9, 'TOTAL', totalStyle('left', CAL_BOLD))
  formulaYellow(ws, totRow, 10, `SUM(J${dataStartRow}:J29)`, { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } }, ACCT_FMT_2)

  // Rows 31-35: LODGED rows — J column yellow
  for (let r = 31; r <= 35; r++) {
    textCell(ws, r, 9, 'LODGED', dataStyle('left', CAL_FONT))
    numCell(ws, r, 10, null, dataStyleYellow('center', CAL_FONT), ACCT_FMT_2)
  }

  // Row 36: Balance = Total Amount - Sum of Lodged
  formulaYellow(ws, 36, 10, `J${totRow}-SUM(J31:J35)`, { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } }, ACCT_FMT_2)
  ws.getRow(36).height = 18.75

  // Fill header row with edge borders
  fillHeaderRow(ws, 4, 2, 11, CAL_BOLD)
  // Fill data grid with borders on all empty cells
  fillGrid(ws, 5, 36, 2, 11, CAL_FONT)
}

// ─── Sheet1 (2) — Lodgement template copy ────────────────────

function writeSheet1Copy(wb) {
  const ws = wb.addWorksheet('Sheet1 (2)', { state: 'hidden', properties: { tabColor: { argb: 'FFFF0000' } } })
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 8, topLeftCell: 'G9', style: 'pageBreakPreview', zoomScale: 89, zoomScaleNormal: 100, showGridLines: true }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 26, printArea: 'A1:W109' }

  // Column widths matching reference (22 columns)
  ws.getColumn(1).width = 6.71
  ws.getColumn(2).width = 14.29
  ws.getColumn(3).width = 17.43
  ws.getColumn(4).width = 4.29
  ws.getColumn(5).width = 14.57
  ws.getColumn(6).width = 3.29
  ws.getColumn(7).width = 14.29
  ws.getColumn(8).width = 3
  ws.getColumn(9).width = 15.29
  ws.getColumn(10).width = 13.43
  ws.getColumn(11).width = 13.43
  ws.getColumn(12).width = 14.71
  ws.getColumn(13).width = 14.71
  ws.getColumn(14).width = 16.71
  ws.getColumn(15).width = 17.71
  ws.getColumn(16).width = 14.29
  ws.getColumn(17).width = 16.71
  ws.getColumn(18).width = 12.29
  ws.getColumn(19).width = 24.43
  ws.getColumn(20).width = 22.29
  ws.getColumn(21).width = 10.29
  ws.getColumn(22).width = 19.71

  // Row 2: Station info headers
  textCell(ws, 2, 2, 'Name of Station', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  textCell(ws, 3, 2, 'Prepared By', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })
  textCell(ws, 4, 2, 'Date of Preparation', { font: FONT_10_BOLD, border: BORDER_THIN, alignment: { horizontal: 'left' } })

  // Row 7: Main headers
  textCell(ws, 7, 2, 'SALES DATE', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 3, 'TOTAL SALES', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 5, 'CASH SALES', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 7, 'CREDIT SALES', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 9, 'ANALYSIS OF POS BY BANKS', hdrStyle(FONT_10_BOLD))
  ws.mergeCells('I7:O7')
  textCell(ws, 7, 16, 'P.O.S', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 17, 'EXPENSES', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 18, 'EXPECTED LODGEMENT', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 19, 'ACTUAL LODGEMENT', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 20, 'TELLER NO', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 21, 'LODGEMENT DATE', hdrStyle(FONT_10_BOLD))
  textCell(ws, 7, 22, 'AREA MANAGERS COMMENT', hdrStyle(FONT_10_BOLD))

  // Row 8: Bank sub-headers (empty template)
  const defaultBanks = ['Zenith Bank', 'Diamond Bank', 'Stanbic Bank', 'GT Bank', 'Providus Bank', 'Access Bank', 'Fidelity Bank']
  for (let i = 0; i < defaultBanks.length; i++) {
    textCell(ws, 8, 9 + i, defaultBanks[i], hdrStyle(FONT_10_BOLD))
  }

  // Data rows 10-108 with formulas
  for (let r = 10; r <= 108; r++) {
    formulaCell(ws, r, 3, `E${r}+G${r}+P${r}`, dataStyle('center', FONT_10))
  }

  // Fill header rows with edge borders
  fillHeaderRow(ws, 7, 2, 22, FONT_10_BOLD)
  fillHeaderRow(ws, 8, 2, 22, FONT_10_BOLD)
  // Fill data grid with borders on all empty cells
  fillGrid(ws, 10, 108, 2, 22, FONT_10)

  unlockNonFormulaCells(ws)
}
