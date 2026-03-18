import ExcelJS from 'exceljs'
import JSZip from 'jszip'

/**
 * Audit Report Excel export — matches the reference template exactly.
 * Sheet order: 1.Guideline, 2.Sales>>Cash Position, 3.Stock Position,
 * 4.Lodgement Sheet, 5-7.Consumption, 8.Product Received,
 * 9.Expenses, 10.Record of Stock Position, Customers' Ledger,
 * Castro Lubricants, Sheet1 (2)
 */

// ─── Styling constants ──────────────────────────────────────
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { theme: 4, tint: 0.3999450666829432 } }

const FONT = { name: 'Corbel', size: 11, color: { theme: 1 } }
const FONT_BOLD = { name: 'Corbel', size: 11, bold: true, color: { theme: 1 } }
const FONT_10 = { name: 'Corbel', size: 10, color: { theme: 1 } }
const FONT_10_BOLD = { name: 'Corbel', size: 10, bold: true, color: { theme: 1 } }
const FONT_12_BOLD = { name: 'Corbel', size: 12, bold: true, color: { theme: 1 } }
const FONT_12_BOLD_UL = { name: 'Corbel', size: 12, bold: true, underline: true, color: { theme: 1 } }
const FONT_BOLD_ITALIC = { name: 'Corbel', size: 11, bold: true, italic: true, color: { theme: 1 } }
const FONT_ITALIC = { name: 'Corbel', size: 11, italic: true, color: { theme: 1 } }
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

  // Load logo and add to workbook
  let logoId = null
  try {
    const logoResp = await fetch('/rainoil-logo.png')
    if (logoResp.ok) {
      const logoBuf = await logoResp.arrayBuffer()
      logoId = wb.addImage({ buffer: logoBuf, extension: 'png' })
    }
  } catch (_) { /* logo is optional */ }

  // Track row references for cross-sheet formulas
  const refs = {}

  writeGuideline(wb, logoId)
  writeSalesCash(wb, report, stationName, startDate, endDate, refs, logoId)
  writeStockPosition(wb, report, stationName, startDate, endDate, refs, logoId)
  writeLodgement(wb, report, stationName, startDate, endDate, refs, logoId)
  writeConsumption(wb, report, startDate, endDate, 'PMS', '5.PMS Consumption and Pour back')
  writeConsumption(wb, report, startDate, endDate, 'AGO', '6.AGO Consumption and Pour back')
  writeConsumption(wb, report, startDate, endDate, 'DPK', '7.DPK Consumption and Pour back')
  writeProductReceived(wb, receipts, tanks, startDate, endDate, refs)
  writeExpenses(wb, expenses)
  writeRecordOfStock(wb, report, refs)
  writeCustomersLedger(wb, customers)
  writeLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate)
  writeSheet1Copy(wb)

  let buffer = await wb.xlsx.writeBuffer()

  // Post-process: inject objects="1" into sheetProtection tags (ExcelJS doesn't write it)
  try {
    const zip = await JSZip.loadAsync(buffer)
    for (const filename of Object.keys(zip.files)) {
      if (filename.startsWith('xl/worksheets/sheet') && filename.endsWith('.xml')) {
        let xml = await zip.file(filename).async('string')
        if (xml.includes('<sheetProtection') && !xml.includes('objects=')) {
          xml = xml.replace(/<sheetProtection /, '<sheetProtection objects="1" ')
        }
        zip.file(filename, xml)
      }
    }
    buffer = await zip.generateAsync({ type: 'arraybuffer' })
  } catch (_) { /* proceed with original buffer if patching fails */ }

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

function writeGuideline(wb, logoId) {
  const ws = wb.addWorksheet('1.Guideline')
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', style: 'pageBreakPreview', zoomScale: 86, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 64, fitToPage: false, printArea: 'A1:D18' }
  ws.getColumn(1).width = 10.57
  ws.getColumn(2).width = 18.57
  ws.getColumn(3).width = 92.71

  const F_BU = { ...FONT, bold: true, underline: true }
  const F_BI = { ...FONT, bold: true, italic: true }
  const F_BIU = { ...FONT, bold: true, italic: true, underline: true }

  const labelStyle = { font: FONT_BOLD, border: { left: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }, alignment: { horizontal: 'center', vertical: 'middle' } }
  const headerStyle = { font: FONT_BOLD, alignment: { vertical: 'top', wrapText: true } }
  const contentBorder = { left: { style: 'medium' }, right: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }
  const contentStyle = { font: FONT, border: contentBorder, alignment: { vertical: 'top', wrapText: true } }

  textCell(ws, 2, 2, 'From>>', headerStyle)
  textCell(ws, 2, 3, 'Internal Audit Department', headerStyle)

  textCell(ws, 3, 2, 'User>>', headerStyle)
  textCell(ws, 3, 3, 'Station and Depot Operations', headerStyle)

  textCell(ws, 4, 2, 'Date of issue>>', headerStyle)
  ws.getRow(4).height = 18.75
  const dateCell4 = ws.getRow(4).getCell(3)
  dateCell4.value = new Date(2020, 0, 1, 12, 0, 0)
  dateCell4.numFmt = MMM_YY
  applyStyle(dateCell4, { font: FONT_BOLD, alignment: { horizontal: 'left', vertical: 'top', wrapText: true } })

  // Row 6: Objective — "Sales/Cash" and "Stock position" are bold+underline
  textCell(ws, 6, 2, 'Objective', labelStyle)
  ws.getRow(6).height = 76.5
  ws.getRow(6).getCell(3).value = {
    richText: [
      { font: FONT, text: 'The objective of this template is to aid the Station Managers in balancing and reporting the ' },
      { font: F_BU, text: 'Sales/Cash' },
      { font: FONT, text: ' and ' },
      { font: F_BU, text: 'Stock position' },
      { font: FONT, text: ' of the Station on a monthly basis. It will also assist the Station Manager in carrying out a Self review of the Station activities for the month for the purpose of reporting an accurate position of the Station\'s lodgement, Expenses, Stock, Product received and Consumptions to the various stakeholders.' },
    ]
  }
  applyStyle(ws.getRow(6).getCell(3), contentStyle)

  // Row 8: Instruction — example is bold+italic, sheet refs are bold+italic+underline, "Yellow" is bold
  textCell(ws, 8, 2, 'Instruction', labelStyle)
  ws.getRow(8).height = 282.75
  ws.getRow(8).getCell(3).value = {
    richText: [
      { font: FONT, text: '1. This report should be sent to the Internal Audit department not later than 4 working days after the end of the reporting month. ' },
      { font: F_BI, text: 'For example, the report for September 2018 should be sent latest by 4th of October 2018.' },
      { font: FONT, text: '\n2. This template is a replica of the Station record (The daily Sales, Expenses, Stock, Lodgment, Product received and Consumption book). Thus, at every point, the data captured herein must agree with what is captured in the Station record.\n3.' },
      { font: F_BIU, text: 'Sheet 2 (Sales/Cash Reconciliaition)' },
      { font: FONT, text: ' contains the Sales/Cash reconciliation and must be balanced before sending it for review to the Internal Audit department.\n4.At no point should there be any difference between the data captured in this template and what is captured in the Station book. This will be reviewed during audit visit for any discrepancy/inconsistency.\n5.' },
      { font: F_BIU, text: 'Sheet 3 (Stock Position)' },
      { font: FONT, text: ' has figures that are linked and protected and as such no data should be keyed-in apart from the respective month and period. The sheet 3 is the result of the stock position of the Station at the end of the month.\n6.Some of the rows are protected expecially the ones ' },
      { font: FONT_BOLD, text: 'highlighted in "Yellow"' },
      { font: FONT, text: '..PLEASE do not bother to populate those cells as they have been formularised and protected to prevent any alteration or modification.\n7. Sheet 2 and 3 (Highlighted in yellow) shows the result of the Station of the month in terms of Sales/cash and Stock respectively. These sheets must be balanced before sending for review on a monthly basis.' },
    ]
  }
  applyStyle(ws.getRow(8).getCell(3), contentStyle)

  // Row 10: Audit Contact — "Cash and Stock Position" is bold+underline
  textCell(ws, 10, 2, 'Audit Contact', labelStyle)
  ws.getRow(10).height = 150.75
  ws.getRow(10).getCell(3).value = {
    richText: [
      { font: FONT, text: 'All the sheets must be populated with accurate figure in order to determine the Actual ' },
      { font: F_BU, text: 'Cash and Stock Position' },
      { font: FONT, text: ' of the Station on a monthly basis. This template will be used by the Internal Auditor in carrying out a detailed audit of the Stations activities for the respective months. If you require any clarification on how to navigate the template, kindly reach out to any of the Internal Auditors.\n\nJohn Oruh---08056799340\n\nEdmond Anifowose--08035127657\n\nEvelyn Chukwulobe--08060109252\n\n' },
    ]
  }
  applyStyle(ws.getRow(10).getCell(3), contentStyle)

  // Logo — top-right area, exact position from reference
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { nativeCol: 2, nativeColOff: 4573984, nativeRow: 0, nativeRowOff: 148828 },
      br: { nativeCol: 3, nativeColOff: 116680, nativeRow: 3, nativeRowOff: 78581 },
      editAs: 'oneCell',
    })
  }

  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })
}

// ─── 2. Sales>>Cash Position ─────────────────────────────────

function writeSalesCash(wb, report, stationName, startDate, endDate, refs, logoId) {
  const ws = wb.addWorksheet('2. Sales>>Cash Position', { properties: { tabColor: { argb: 'FFFFFF00' } } })
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 8, topLeftCell: 'A10', style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  // pageSetup set dynamically at end of function
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })
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

  // Row 3: Station name + title (medium borders on title cells only)
  textCell(ws, 3, 2, ' STATION NAME:', { font: FONT_BOLD, alignment: { horizontal: 'left' } })
  textCell(ws, 3, 3, stationName || '', { font: FONT_BOLD, fill: BLUE_FILL, alignment: { horizontal: 'left' } })
  const titleDateStr = (() => {
    if (!endDate) return ''
    const dt = new Date(endDate + 'T00:00:00')
    const day = dt.getDate()
    const suffix = [, 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10) * (day % 10)] || 'th'
    const month = dt.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
    return `${day}${suffix} ${month} ${dt.getFullYear()}`
  })()
  const titleText = `CASH/SALES RECONCILIATION ${titleDateStr}`
  textCell(ws, 3, 4, titleText, { font: FONT_BOLD, border: { left: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }, alignment: { horizontal: 'center' } })
  applyStyle(ws.getRow(3).getCell(5), { border: { right: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } } })
  ws.mergeCells('D3:E3')
  ws.getRow(3).height = 15.75

  // Row 5: Period of audit (all medium borders)
  const BORDER_MED_ALL = { left: { style: 'medium' }, right: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }
  const BORDER_MED_TB = { top: { style: 'medium' }, bottom: { style: 'medium' } }
  textCell(ws, 5, 2, 'Period of Audit', { font: FONT_BOLD, border: BORDER_MED_ALL, alignment: { horizontal: 'left' } })
  const periodText = `${fmtDateDisplay(startDate)}- ${fmtDateDisplay(endDate)}`
  textCell(ws, 5, 3, periodText, { font: FONT_BOLD, border: BORDER_MED_TB, alignment: { horizontal: 'center' } })
  for (let c = 4; c <= 6; c++) applyStyle(ws.getRow(5).getCell(c), { border: BORDER_MED_TB })
  applyStyle(ws.getRow(5).getCell(7), { border: { right: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } } })
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

  const spacerRows = []
  const closingRows = []
  let topBorderRow = 0
  for (let ftIdx = 0; ftIdx < fuelTypes.length; ftIdx++) {
    const ft = fuelTypes[ftIdx]
    const summary = salesCash.fuelSummaries[ft]
    if (!summary) continue

    const alloc = FUEL_ALLOC[ft] || { pumpRows: 77, pourBackRows: 5, consumeRows: 12 }
    const ftRefs = { firstDataRow: 0, lastDataRow: 0, totalARow: 0, pourBackStart: 0, pourBackEnd: 0, netRow: 0, consumeStart: 0, consumeEnd: 0, totalDRow: 0, expectedRow: 0 }
    refs.sales[ft] = ftRefs

    // Section header — number in B, title merged C-G
    // Borders: T:medium, B:medium on all; L:medium on B, R:medium on G
    const sectionBorderB = { left: { style: 'medium' }, right: { style: 'thin' }, top: { style: 'medium' }, bottom: { style: 'medium' } }
    const sectionBorderMid = { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'medium' }, bottom: { style: 'medium' } }
    const sectionBorderG = { left: { style: 'thin' }, right: { style: 'medium' }, top: { style: 'medium' }, bottom: { style: 'medium' } }
    textCell(ws, row, 2, ftIdx + 1, { font: FONT_BOLD, border: sectionBorderB, alignment: { horizontal: 'center' } })
    textCell(ws, row, 3, `${ft} Sales for the ${ftIdx === 0 ? 'Period' : 'period'}`, { font: FONT_BOLD, border: sectionBorderMid, alignment: { horizontal: 'center' } })
    for (let c = 4; c <= 6; c++) applyStyle(ws.getRow(row).getCell(c), { border: sectionBorderMid })
    applyStyle(ws.getRow(row).getCell(7), { border: sectionBorderG })
    ws.mergeCells(row, 3, row, 4)
    row++

    // Meter reading column headers — no top border, bottom:thin, L:medium on B, R:medium on G
    const colHdrB = { left: { style: 'medium' }, right: { style: 'thin' }, bottom: { style: 'thin' } }
    const colHdrMid = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } }
    const colHdrG = { left: { style: 'thin' }, right: { style: 'medium' }, bottom: { style: 'thin' } }
    const colHdrStyle = (border) => ({ font: FONT_BOLD, border, alignment: { horizontal: 'center' } })
    textCell(ws, row, 2, 'Meter reading', colHdrStyle(colHdrB))
    // PMS has dates in Opening/Closing; AGO/DPK don't
    const openLabel = ftIdx === 0 ? `Opening (${fmtDateDisplay(startDate)})` : 'Opening'
    const closeLabel = ftIdx === 0 ? `Closing (${fmtDateDisplay(endDate)})` : 'Closing'
    textCell(ws, row, 3, openLabel, colHdrStyle(colHdrMid))
    textCell(ws, row, 4, closeLabel, colHdrStyle(colHdrMid))
    // PMS has spaces in Qty col; AGO/DPK have "Quantity dispensed"
    textCell(ws, row, 5, ftIdx === 0 ? '   ' : 'Quantity dispensed', colHdrStyle(colHdrMid))
    textCell(ws, row, 6, 'Price', colHdrStyle(colHdrMid))
    textCell(ws, row, 7, 'Amount', colHdrStyle(colHdrG))
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

      for (let pi = 0; pi < period.pumps.length; pi++) {
        const pump = period.pumps[pi]
        textCell(ws, row, 2, `Pump ${pi + 1}`, { font: FONT_BOLD, border: BORDER_THIN, alignment: { horizontal: 'center' } })
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
    textCell(ws, row, 2, 'A', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    textCell(ws, row, 3, `Total ${ft}  Sales for the period`, { font: FONT_BOLD_ITALIC, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center', wrapText: true } })
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
    textCell(ws, row, 2, ' B', { font: RED_FONT, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    textCell(ws, row, 3, `Less Pourback on ${ft} for the Period`, { font: FONT_BOLD_ITALIC, border: BORDER_THIN, alignment: { horizontal: 'left', wrapText: true } })
    formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())

    const pbNameStyle = { font: FONT, border: BORDER_THIN, alignment: { horizontal: 'center' } }
    if (pourBackGroups.length > 0) {
      numCell(ws, row, 5, pourBackGroups[0]?.totalQty || 0, dataStyle())
      numCell(ws, row, 6, pourBackGroups[0]?.price || 0, dataStyle())
      row++
      for (let pi = 1; pi < pourBackGroups.length; pi++) {
        const g = pourBackGroups[pi]
        textCell(ws, row, 3, g.name || '', pbNameStyle)
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
      if (defName) textCell(ws, row, 3, defName, pbNameStyle)
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
      row++
    }
    ftRefs.pourBackEnd = row - 1

    // C=A-B = Net Sales (yellow across all cols B-G)
    ftRefs.netRow = row
    textCell(ws, row, 2, 'C=A-B', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    textCell(ws, row, 3, `Net ${ft} Sales for the period`, { font: FONT_BOLD_ITALIC, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `E${ftRefs.totalARow}-SUM(E${ftRefs.pourBackStart}:E${ftRefs.pourBackEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `G${ftRefs.totalARow}-SUM(G${ftRefs.pourBackStart}:G${ftRefs.pourBackEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Blank spacer
    row++

    // Less Consumption header
    textCell(ws, row, 3, `Less Consumption on ${ft}`, { font: FONT_BOLD_ITALIC, border: BORDER_THIN, alignment: { horizontal: 'center', wrapText: true } })
    row++

    // Consumption detail rows — merge actual data with default account names
    ftRefs.consumeStart = row
    const csDefaults = DEFAULT_CONSUME_NAMES[ft] || []
    const consumedGroups = summary.consumption?.consumedByPrice || []
    const consumeAlloc = Math.max(alloc.consumeRows, consumedGroups.length, csDefaults.length)

    // Write actual consumption data first (italic + center for names)
    const consumeNameStyle = { font: FONT_ITALIC, border: BORDER_THIN, alignment: { horizontal: 'center' } }
    for (const group of consumedGroups) {
      textCell(ws, row, 3, group.name || '', consumeNameStyle)
      numCell(ws, row, 5, group.totalQty, dataStyle())
      numCell(ws, row, 6, group.price, dataStyle())
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
      row++
    }
    // Fill remaining consumption rows with default names by position
    for (let i = consumedGroups.length; i < consumeAlloc; i++) {
      const defName = i < csDefaults.length ? csDefaults[i] : null
      if (defName) textCell(ws, row, 3, defName, consumeNameStyle)
      formulaYellow(ws, row, 7, `E${row}*F${row}`, dataStyleYellow())
      row++
    }
    ftRefs.consumeEnd = row - 1

    // D = Total Consumption (yellow across all cols B-G)
    ftRefs.totalDRow = row
    textCell(ws, row, 2, 'D', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    textCell(ws, row, 3, `Total Consumption of ${ft} for the Period`, { font: FONT_BOLD_ITALIC, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'left', wrapText: true } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `SUM(E${ftRefs.consumeStart}:E${ftRefs.consumeEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `SUM(G${ftRefs.consumeStart}:G${ftRefs.consumeEnd})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Blank spacer
    row++

    // E=C-D = Expected Sales (yellow across all cols B-G)
    ftRefs.expectedRow = row
    textCell(ws, row, 2, 'E=C-D', { font: RED_FONT, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    textCell(ws, row, 3, `Expected ${ft} Sales for the period`, { font: FONT_BOLD_ITALIC, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center', wrapText: true } })
    applyStyle(ws.getRow(row).getCell(4), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 5, `E${ftRefs.netRow}-E${ftRefs.totalDRow}`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    applyStyle(ws.getRow(row).getCell(6), { fill: YELLOW_FILL, border: BORDER_THIN, font: FONT_BOLD })
    formulaYellow(ws, row, 7, `G${ftRefs.netRow}-G${ftRefs.totalDRow}`, { font: FONT_BOLD, fill: YELLOW_FILL, border: BORDER_THIN, alignment: { horizontal: 'center' } })
    row++

    // Closing border row (T:thin, B:medium) after every fuel section
    closingRows.push(row)
    row++

    // Spacer rows between fuel types (outer edges only) or before reconciliation
    if (ftIdx < fuelTypes.length - 1) {
      spacerRows.push(row, row + 1)
      row += 2
    } else {
      // After last fuel type: 1 spacer row, then top-border row before reconciliation
      spacerRows.push(row)
      row++
      // Top border row (T:medium, outer edges)
      topBorderRow = row
      row++
    }
  }

  // Fill fuel section grid with borders (stops before reconciliation)
  fillGrid(ws, 7, row - 1, 2, 7, FONT)

  // Fix closing rows — T:thin, B:medium (section bottom border)
  for (const cr of closingRows) {
    ws.getRow(cr).getCell(2).border = { left: { style: 'medium' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'medium' } }
    for (let c = 3; c <= 6; c++) ws.getRow(cr).getCell(c).border = { left: { style: 'thin' }, right: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'medium' } }
    ws.getRow(cr).getCell(7).border = { left: { style: 'thin' }, right: { style: 'medium' }, top: { style: 'thin' }, bottom: { style: 'medium' } }
  }

  // Clear spacer rows back to outer-edges-only (fillGrid added thin borders)
  for (const sr of spacerRows) {
    ws.getRow(sr).getCell(2).border = { left: { style: 'medium' } }
    for (let c = 3; c <= 6; c++) ws.getRow(sr).getCell(c).border = {}
    ws.getRow(sr).getCell(7).border = { right: { style: 'medium' } }
  }

  // Top border row before reconciliation (T:medium, outer edges)
  if (topBorderRow) {
    ws.getRow(topBorderRow).getCell(2).border = { left: { style: 'medium' }, top: { style: 'medium' } }
    for (let c = 3; c <= 6; c++) ws.getRow(topBorderRow).getCell(c).border = { top: { style: 'medium' } }
    ws.getRow(topBorderRow).getCell(7).border = { right: { style: 'medium' }, top: { style: 'medium' } }
  }

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
  // Formula: Net Expected - POS - Transfers - Lodgement + (Closing - Opening) credit balances
  const tfrRow = refs.lodgementTotalRow || 172
  const tfrColLetters = refs.transferBankColLetters || []
  const tfrPart = tfrColLetters.length > 0
    ? tfrColLetters.map(cl => `-'4.Lodgement Sheet'!${cl}${tfrRow}`).join('')
    : ''
  textCell(ws, row, 2, 'Overage/Shortage', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
  formulaYellow(ws, row, 7, `G${refs.netExpectedRow}-G${refs.totalPOSRow}${tfrPart}-G${refs.totalLodgementRow}-(G${refs.openingBalRow}-G${refs.closingBalRow})`, { font: FONT_BOLD, fill: YELLOW_FILL, border: { top: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'medium' } }, alignment: { horizontal: 'center' } })
  row++

  // Bottom border row (B:medium across B-G)
  for (let c = 2; c <= 7; c++) {
    const cell = ws.getRow(row).getCell(c)
    cell.border = { bottom: { style: 'medium' }, left: c === 2 ? { style: 'medium' } : undefined, right: c === 7 ? { style: 'medium' } : undefined }
    cell.font = FONT
  }
  row++

  ws.pageSetup = { scale: 18, printArea: `A1:H${row + 2}` }

  // Logo — top-right, exact position from reference
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { nativeCol: 5, nativeColOff: 824725, nativeRow: 0, nativeRowOff: 139391 },
      br: { nativeCol: 7, nativeColOff: 375432, nativeRow: 3, nativeRowOff: 53206 },
      editAs: 'oneCell',
    })
  }

  unlockNonFormulaCells(ws)
}

// ─── 3. Stock Position ───────────────────────────────────────

function writeStockPosition(wb, report, stationName, startDate, endDate, refs, logoId) {
  const ws = wb.addWorksheet('3.Stock Position', { properties: { tabColor: { argb: 'FFFFFF00' }, defaultRowHeight: 15.75 } })
  ws.views = [{ style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }]
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })
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

  // Bold+italic font for spacer/closing rows (matching reference BI style)
  const FONT_BI = { name: 'Corbel', size: 11, bold: true, italic: true, color: { theme: 1 } }

  // Row 2: Audit report title — bold+underline, L:medium border on C
  textCell(ws, 2, 3, `AUDIT REPORT FOR :  ${stationName || ''} STATION`, { font: FONT_12_BOLD_UL, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
  ws.getRow(2).height = 18.75

  // Row 3: Stock position period — bold+underline, L:medium border on C
  textCell(ws, 3, 3, `STOCK POSITION FOR THE PERIOD (${fmtDateDisplay(startDate)}- ${fmtDateDisplay(endDate)})`, { font: FONT_12_BOLD_UL, border: { left: { style: 'medium' } }, alignment: { horizontal: 'left' } })
  ws.getRow(3).height = 18.75

  // Row 4: empty row with L:medium on C (matching reference)
  ws.getRow(4).getCell(3).border = { left: { style: 'medium' } }
  ws.getRow(4).getCell(3).font = FONT_BOLD
  ws.getRow(4).getCell(3).alignment = { horizontal: 'left', vertical: 'top' }

  refs.stock = {}

  const fuelSheetMap = {
    PMS: { openCol: 'C', recCol: 'F', prodExpCol: 'D', prodActCol: 'F', dispRef: null },
    AGO: { openCol: 'I', recCol: 'L', prodExpCol: 'I', prodActCol: 'K', dispRef: null },
    DPK: { openCol: 'O', recCol: 'R', prodExpCol: 'N', prodActCol: 'P', dispRef: null },
  }

  let row = 5

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const t = data.totals
    const fMap = fuelSheetMap[ft] || {}

    refs.stock[ft] = { sectionStart: row }

    // Border styles matching reference
    const borderC = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } }
    const borderD = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } }
    const stockLabelStyle = { font: FONT_BOLD, border: borderC, alignment: { horizontal: 'left', vertical: 'top' } }
    const stockValueBold = { font: FONT_BOLD, border: borderD, alignment: { horizontal: 'right', vertical: 'top' } }
    const stockValueReg = { font: FONT, border: borderD, alignment: { horizontal: 'right', vertical: 'top' } }

    // Helper: spacer row within table (thin all-around borders, empty)
    const spacerRow = (r) => {
      ws.getRow(r).getCell(3).border = borderC
      ws.getRow(r).getCell(3).font = FONT_BOLD
      ws.getRow(r).getCell(3).alignment = { horizontal: 'left', vertical: 'top' }
      ws.getRow(r).getCell(4).border = borderD
      ws.getRow(r).getCell(4).font = FONT_BOLD
      ws.getRow(r).getCell(4).alignment = { horizontal: 'right', vertical: 'top' }
    }

    // Helper: outer-edges-only spacer (between table and litres, or between sections)
    const outerEdges = (r, fontStyle) => {
      ws.getRow(r).getCell(3).border = { left: { style: 'medium' } }
      ws.getRow(r).getCell(3).font = fontStyle || FONT_BI
      ws.getRow(r).getCell(3).alignment = { horizontal: 'left', vertical: 'top' }
      ws.getRow(r).getCell(4).border = { right: { style: 'medium' } }
      ws.getRow(r).getCell(4).font = fontStyle || FONT_BI
      ws.getRow(r).getCell(4).alignment = { horizontal: 'left', vertical: 'top' }
    }

    // Separator row above section header: BI font, medium all-around
    ws.getRow(row).getCell(3).border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } }
    ws.getRow(row).getCell(3).font = FONT_BI
    ws.getRow(row).getCell(3).alignment = { horizontal: 'left', vertical: 'top' }
    ws.getRow(row).getCell(4).border = { top: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } }
    ws.getRow(row).getCell(4).font = FONT_BI
    ws.getRow(row).getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
    if (row === 5) ws.getRow(row).height = 16.5
    row++

    // Section header: yellow fill, center/middle, medium vertical edges
    textCell(ws, row, 3, `${ft} STOCK POSITION`, { font: FONT_BOLD, fill: YELLOW_FILL, border: { left: { style: 'medium' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'middle' } })
    textCell(ws, row, 4, "Per Manager's Computation", { font: FONT_BOLD, fill: YELLOW_FILL, border: { left: { style: 'thin' }, right: { style: 'medium' } }, alignment: { horizontal: 'center', vertical: 'middle' } })
    if (ft === 'PMS') ws.getRow(row).height = 25.5
    else if (ft === 'AGO') ws.getRow(row).height = 18.75
    else if (ft === 'DPK') ws.getRow(row).height = 24
    row++

    // OPENING STOCK
    textCell(ws, row, 3, `OPENING STOCK (${fmtDateDisplay(startDate)})`, stockLabelStyle)
    if (fMap.openCol) {
      formulaCell(ws, row, 4, `'10.Record of Stock Position'!${fMap.openCol}8`, stockValueReg)
    } else {
      numCell(ws, row, 4, t.opening, stockValueReg)
    }
    const openRow = row
    row++

    spacerRow(row)
    row++

    // SUPPLIES DURING THE PERIOD
    textCell(ws, row, 3, 'SUPPLIES DURING THE PERIOD ', stockLabelStyle)
    if (fMap.prodActCol) {
      formulaCell(ws, row, 4, `'8.Product Received'!${fMap.prodActCol}52`, stockValueReg, NUM_FMT)
    } else {
      numCell(ws, row, 4, t.supply, stockValueReg, NUM_FMT)
    }
    const supplyRow = row
    row++

    spacerRow(row)
    row++

    // STOCK AVAILABLE FOR SALE = OPENING + SUPPLY
    textCell(ws, row, 3, 'STOCK AVAILABLE FOR SALE', stockLabelStyle)
    formulaCell(ws, row, 4, `+D${openRow}+D${supplyRow}`, stockValueReg)
    const stockAvailRow = row
    row++

    spacerRow(row)
    row++

    // CLOSING STOCK
    textCell(ws, row, 3, `CLOSING STOCK (${fmtDateDisplay(endDate)})`, stockLabelStyle)
    if (fMap.recCol) {
      formulaCell(ws, row, 4, `'10.Record of Stock Position'!${fMap.recCol}40`, stockValueBold)
    } else {
      numCell(ws, row, 4, t.closing, stockValueBold)
    }
    const closingRow = row
    row++

    spacerRow(row)
    row++

    // QUANTITY SOLD = AVAILABLE - CLOSING
    textCell(ws, row, 3, 'QUANTITY SOLD', stockLabelStyle)
    formulaCell(ws, row, 4, `D${stockAvailRow}-D${closingRow}`, stockValueBold)
    const qtySoldRow = row
    row++

    spacerRow(row)
    row++

    // QUANTITY DISPENSED
    textCell(ws, row, 3, 'QUANTITY DISPENSED ', stockLabelStyle)
    const salesNetRef = refs.sales[ft]?.netRow
    if (salesNetRef) {
      formulaCell(ws, row, 4, `'2. Sales>>Cash Position'!E${salesNetRef}`, stockValueBold, NUM_FMT)
    } else {
      numCell(ws, row, 4, t.dispensed, stockValueBold, NUM_FMT)
    }
    const dispRow = row
    row++

    spacerRow(row)
    row++

    // OVERAGE/(SHORTAGE)
    textCell(ws, row, 3, 'OVERAGE/(SHORTAGE)', stockLabelStyle)
    formulaCell(ws, row, 4, `D${dispRow}-D${qtySoldRow}`, stockValueBold)
    row++

    // Closing row: BI font, T:thin|B:medium
    ws.getRow(row).getCell(3).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } }
    ws.getRow(row).getCell(3).font = FONT_BI
    ws.getRow(row).getCell(3).alignment = { horizontal: 'left', vertical: 'top' }
    ws.getRow(row).getCell(4).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } }
    ws.getRow(row).getCell(4).font = FONT_BI
    ws.getRow(row).getCell(4).alignment = { horizontal: 'right', vertical: 'top' }
    ws.getRow(row).getCell(4).numFmt = ACCT_PAREN
    row++

    // 2 spacer rows with outer edges only, BI font (gap between table and litres)
    outerEdges(row, FONT_BI)
    row++
    outerEdges(row, FONT_BI)
    row++

    // EXPECTED LITRES — bold label, outer edges only, top alignment
    textCell(ws, row, 3, 'EXPECTED LITRES', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { vertical: 'top' } })
    if (fMap.prodExpCol) {
      formulaCell(ws, row, 4, `'8.Product Received'!${fMap.prodExpCol}52`, { font: FONT, border: { right: { style: 'medium' } } })
    } else {
      numCell(ws, row, 4, t.expectedLitres, { font: FONT, border: { right: { style: 'medium' } } })
    }
    const expLitresRow = row
    row++

    // Spacer
    outerEdges(row, FONT_BOLD)
    ws.getRow(row).getCell(3).alignment = { vertical: 'top' }
    row++

    // ACTUAL LITRES RECEIVED — bold label, outer edges only
    textCell(ws, row, 3, 'ACTUAL LITRES RECEIVED', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { vertical: 'top' } })
    if (fMap.prodActCol) {
      formulaCell(ws, row, 4, `'8.Product Received'!${fMap.prodActCol}52`, { font: FONT, border: { right: { style: 'medium' } } })
    } else {
      numCell(ws, row, 4, t.actualLitresReceived, { font: FONT, border: { right: { style: 'medium' } } })
    }
    const actLitresRow = row
    row++

    // Spacer
    outerEdges(row, FONT_BOLD)
    ws.getRow(row).getCell(3).alignment = { vertical: 'top' }
    row++

    // OVERAGE/(SHORTAGE) - TRUCK DRIVER: C gets L:medium, D gets T:thin|B:double|R:medium, center/top
    textCell(ws, row, 3, 'OVERAGE/(SHORTAGE) - TRUCK DRIVER', { font: FONT_BOLD, border: { left: { style: 'medium' } }, alignment: { vertical: 'top' } })
    formulaCell(ws, row, 4, `D${actLitresRow}-D${expLitresRow}`, { font: FONT_BOLD, border: { top: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'medium' } }, alignment: { horizontal: 'center', vertical: 'top' } }, ACCT_PAREN)
    row++

    // Spacer rows after TRUCK DRIVER: outer edges, BI font
    // Between sections: enough spacers for visual gap (next section's separator row provides the top border)
    // After last section: 1 spacer + 1 bottom-border row to close the frame
    outerEdges(row, FONT_BI)
    row++
    outerEdges(row, FONT_BI)
    row++
  }

  // Bottom border row to close the frame: B:medium on both C and D
  ws.getRow(row).getCell(3).border = { bottom: { style: 'medium' }, left: { style: 'medium' } }
  ws.getRow(row).getCell(3).font = FONT_BI
  ws.getRow(row).getCell(4).border = { bottom: { style: 'medium' }, right: { style: 'medium' } }
  ws.getRow(row).getCell(4).font = FONT_BI

  // Dynamic print area
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, scale: 38, printArea: `B2:E${row + 2}`, margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } }

  // Logo — exact position from reference
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { nativeCol: 3, nativeColOff: 678656, nativeRow: 1, nativeRowOff: 47625 },
      br: { nativeCol: 4, nativeColOff: 329840, nativeRow: 3, nativeRowOff: 65983 },
      editAs: 'oneCell',
    })
  }

  unlockNonFormulaCells(ws)
}

// ─── 4. Lodgement Sheet ─────────────────────────────────────

function writeLodgement(wb, report, stationName, startDate, endDate, refs, logoId) {
  const ws = wb.addWorksheet('4.Lodgement Sheet')
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 9, topLeftCell: 'E10', style: 'pageBreakPreview', zoomScale: 85, zoomScaleNormal: 100, showGridLines: false }]
  ws.pageSetup = { orientation: 'portrait', paperSize: 9, scale: 22, printArea: 'A1:Z175' }
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })
  const { lodgementSheet } = report
  if (!lodgementSheet) return

  const { rows, banks, totals } = lodgementSheet
  const posBanks = banks.filter(b => b.lodgement_type === 'pos')
  const transferBanks = banks.filter(b => b.lodgement_type === 'transfer')
  // Both POS and transfer banks appear in the bank columns (no distinction in header)
  const displayBanks = banks.filter(b => b.lodgement_type === 'pos' || b.lodgement_type === 'transfer')
  // Track which displayBanks indices are POS (for Total POS formula — excludes transfers)
  const posBankColIndices = []
  for (let i = 0; i < displayBanks.length; i++) {
    if (displayBanks[i].lodgement_type === 'pos') posBankColIndices.push(i)
  }

  // Fixed column widths matching reference
  ws.getColumn(1).width = 6.71   // A
  ws.getColumn(2).width = 18.43  // B - Sales Date
  ws.getColumn(3).width = 17.43  // C - Total Sales
  ws.getColumn(4).width = 4.29   // D - spacer
  ws.getColumn(5).width = 14.57  // E - Cash Sales
  ws.getColumn(6).width = 3.29   // F - spacer
  ws.getColumn(7).width = 14.29  // G - Credit Sales
  ws.getColumn(8).width = 3.00   // H - spacer

  // Bank columns I onwards
  const bankStartCol = 9 // I
  const bankCols = Math.max(displayBanks.length, 8)
  const refBankWidths = [15.29, 13.43, 13.43, 14.71, 14.71, 16.71, 17.71, 16.57]
  for (let i = 0; i < bankCols; i++) {
    ws.getColumn(bankStartCol + i).width = refBankWidths[i] || 14.71
  }
  const bankEndCol = bankStartCol + bankCols - 1
  const qCol = bankStartCol + bankCols  // Total POS
  const rCol = qCol + 1                  // Expenses
  const sCol = rCol + 1                  // Expected Lodgement
  const tCol = sCol + 1                  // Actual Lodgement
  const uCol = tCol + 1                  // Teller No
  const vCol = uCol + 1                  // Lodgement Date
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

  // Build POS-only sum formula for a given row (Q column)
  const posSumFormula = (r) => {
    if (posBankColIndices.length === 0) return '0'
    return posBankColIndices.map(i => `${colLetter(bankStartCol + i)}${r}`).join('+')
  }

  // Row 2-4: Station info — no borders (matching reference)
  textCell(ws, 2, 2, 'Name of Station', { font: FONT_10_BOLD })
  textCell(ws, 2, 3, `${stationName || ''} BRANCH`, { font: FONT_10_BOLD })
  textCell(ws, 3, 2, 'Date of Preparation', { font: FONT_10_BOLD })
  textCell(ws, 4, 2, 'For>>', { font: FONT_10_BOLD })
  textCell(ws, 4, 3, 'Internal Audit', { font: FONT_10_BOLD })
  ws.getRow(4).height = 14.25

  // ── Row 8: Main headers ──
  // Border patterns from reference: B-H get T:medium, bank merge gets T:medium|B:medium,
  // Q gets T:medium|L:medium|R:medium, R-V get T:medium, W-Z get T:-|L:medium
  const r8 = 8
  const hdrBorderBH = { top: { style: 'medium' } }
  const hdrBorderBank = { top: { style: 'medium' }, bottom: { style: 'medium' } }
  const hdrBorderQ = { top: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }
  const hdrBorderRV = { top: { style: 'medium' } }
  const hdrBorderW = { left: { style: 'medium' } }
  const hdrFont = FONT_10_BOLD
  const hdrAlign = { horizontal: 'center' }

  textCell(ws, r8, 2, 'SALES DATE', { font: hdrFont, border: { ...hdrBorderBH, left: { style: 'medium' }, right: { style: 'thin' } }, alignment: hdrAlign })
  textCell(ws, r8, 3, 'TOTAL SALES', { font: hdrFont, border: { ...hdrBorderBH, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: hdrAlign })
  for (let c = 4; c <= 8; c++) {
    const label = c === 5 ? 'CASH SALES' : c === 7 ? 'CREDIT SALES' : ''
    const brd = { ...hdrBorderBH, left: { style: 'thin' }, right: c === 8 ? undefined : { style: 'thin' } }
    if (c === 8) delete brd.right
    textCell(ws, r8, c, label, { font: hdrFont, border: brd, alignment: hdrAlign })
  }

  // Bank merge: T:medium|B:medium across I-P
  textCell(ws, r8, bankStartCol, 'ANALYSIS OF POS BY BANKS', { font: hdrFont, border: hdrBorderBank, alignment: hdrAlign })
  if (bankCols > 1) ws.mergeCells(r8, bankStartCol, r8, bankEndCol)
  // Set right border on last bank cell of merged range
  ws.getRow(r8).getCell(bankEndCol).border = { ...hdrBorderBank, right: { style: 'medium' } }

  textCell(ws, r8, qCol, 'P.O.S', { font: hdrFont, border: hdrBorderQ, alignment: hdrAlign })
  textCell(ws, r8, rCol, 'EXPENSES', { font: hdrFont, border: { ...hdrBorderRV, right: { style: 'thin' } }, alignment: hdrAlign })
  textCell(ws, r8, sCol, 'EXPECTED LODGEMENT', { font: hdrFont, border: { ...hdrBorderRV, left: { style: 'thin' }, right: { style: 'medium' } }, alignment: hdrAlign })
  textCell(ws, r8, tCol, 'ACTUAL LODGEMENT', { font: hdrFont, border: { ...hdrBorderRV, left: { style: 'medium' }, right: { style: 'medium' } }, alignment: hdrAlign })
  textCell(ws, r8, uCol, 'TELLER NO', { font: hdrFont, border: { ...hdrBorderRV, left: { style: 'medium' }, right: { style: 'medium' } }, alignment: hdrAlign })
  textCell(ws, r8, vCol, 'LODGEMENT DATE', { font: hdrFont, border: { ...hdrBorderRV, left: { style: 'medium' }, right: { style: 'medium' } }, alignment: hdrAlign })
  textCell(ws, r8, wCol, 'AREA MANAGERS COMMENT', { font: hdrFont, border: hdrBorderW, alignment: hdrAlign })
  if (wCol + 3 <= 30) ws.mergeCells(r8, wCol, r8, wCol + 3)

  // ── Row 9: Bank sub-headers + row 10 separator — all T:medium|B:medium ──
  const subHdrBorder = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
  const subHdrStyle = { font: hdrFont, border: subHdrBorder, alignment: hdrAlign }

  // B-H: empty cells with T:medium|B:medium
  for (let c = 2; c <= 8; c++) {
    const brd = { ...subHdrBorder }
    if (c === 2) brd.left = { style: 'medium' }
    ws.getRow(9).getCell(c).border = brd
    ws.getRow(9).getCell(c).font = hdrFont
    ws.getRow(9).getCell(c).alignment = hdrAlign
  }

  // Bank name sub-headers — no (T) suffix
  for (let i = 0; i < displayBanks.length; i++) {
    textCell(ws, 9, bankStartCol + i, displayBanks[i].bank_name, subHdrStyle)
  }
  // Fill remaining bank columns
  for (let i = displayBanks.length; i < bankCols; i++) {
    ws.getRow(9).getCell(bankStartCol + i).border = subHdrBorder
    ws.getRow(9).getCell(bankStartCol + i).font = hdrFont
    ws.getRow(9).getCell(bankStartCol + i).alignment = hdrAlign
  }

  textCell(ws, 9, qCol, 'Total POS', subHdrStyle)
  // R-V empty sub-headers
  for (let c = rCol; c <= vCol; c++) {
    const brd = { ...subHdrBorder }
    if (c === vCol) brd.right = { style: 'medium' }
    ws.getRow(9).getCell(c).border = brd
    ws.getRow(9).getCell(c).font = hdrFont
    ws.getRow(9).getCell(c).alignment = hdrAlign
  }

  // Row 10: empty separator — T:medium|B:medium on all columns
  for (let c = 2; c <= vCol; c++) {
    const brd = { ...subHdrBorder }
    if (c === 2) brd.left = { style: 'medium' }
    if (c === vCol) brd.right = { style: 'medium' }
    // Q col right border
    if (c === qCol) brd.right = undefined
    ws.getRow(10).getCell(c).border = brd
    ws.getRow(10).getCell(c).font = hdrFont
    ws.getRow(10).getCell(c).alignment = hdrAlign
  }

  // ── Data rows starting at row 11 ──
  const dataStartRow = 11
  let row = dataStartRow

  const visibleRows = rows.filter(r => r.hasData)
  const sumBanks = (amounts, list) => list.reduce((s, b) => s + (amounts[b.id] || 0), 0)

  // Border styles for data rows
  const dataBorderStd = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  const dataBorderBank = { bottom: { style: 'thin' }, left: { style: 'thin' } } // bank cols: L:thin only, no R
  const dataBorderQ = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } } // Q: R:medium
  const dataBorderFirst = { bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } } // B col: L:medium
  const dataBorderLast = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } } // V col: R:medium

  const dStyle = (border, align) => ({ font: FONT_10, border, alignment: { horizontal: align || 'center' } })
  const dStyleYellow = (border, align) => ({ font: FONT_10, fill: YELLOW_FILL, border, alignment: { horizontal: align || 'center' } })

  // Write each day: POS row, E-BILL row, blank row
  for (const r of visibleRows) {
    const tPOS = sumBanks(r.bankAmounts, posBanks)
    const tTransfer = sumBanks(r.bankAmounts, transferBanks)

    // Row 1: Date + Cash Sales + Bank amounts + POS total + Expected
    dateCell(ws, row, 2, r.date, dStyle(dataBorderFirst, 'center'))

    // C = E + G + Q (Total Sales formula) — yellow fill
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dStyleYellow(dataBorderStd, 'center'))

    // D spacer
    // E = Cash Sales
    numCell(ws, row, 5, r.totalSales - tPOS - tTransfer, dStyle(dataBorderStd))

    // Bank amounts (POS + transfer in same columns)
    for (let i = 0; i < displayBanks.length; i++) {
      numCell(ws, row, bankStartCol + i, r.bankAmounts[displayBanks[i].id] || 0, dStyle(dataBorderBank))
    }

    // Q = sum of POS bank columns only — yellow fill, right-aligned
    formulaYellow(ws, row, qCol, posSumFormula(row), dStyleYellow(dataBorderQ, 'right'))

    // S = E - R (Expected Lodgement) — yellow fill
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dStyleYellow(dataBorderStd))

    // U = Teller No, V = Lodgement Date
    textCell(ws, row, uCol, 'POS', dStyle(dataBorderStd, 'center'))
    dateCell(ws, row, vCol, r.date, dStyle(dataBorderLast, 'center'))
    row++

    // Row 2: Actual lodgement + E-BILL
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dStyleYellow(dataBorderStd, 'center'))
    formulaYellow(ws, row, qCol, posSumFormula(row), dStyleYellow(dataBorderQ, 'right'))
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dStyleYellow(dataBorderStd))
    numCell(ws, row, tCol, r.actual ?? 0, dStyle(dataBorderStd))
    textCell(ws, row, uCol, 'E-BILL', dStyle(dataBorderStd, 'center'))
    row++

    // Row 3: Blank spacer with formulas
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dStyleYellow(dataBorderStd, 'center'))
    formulaYellow(ws, row, qCol, posSumFormula(row), dStyleYellow(dataBorderQ, 'right'))
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dStyleYellow(dataBorderStd))
    row++
  }

  // Fill remaining rows up to 171 with blank formula rows
  const maxDataRow = 171
  while (row <= maxDataRow) {
    formulaYellow(ws, row, 3, `${colLetter(5)}${row}+${colLetter(7)}${row}+${colLetter(qCol)}${row}`, dStyleYellow(dataBorderStd, 'center'))
    formulaYellow(ws, row, qCol, posSumFormula(row), dStyleYellow(dataBorderQ, 'right'))
    formulaYellow(ws, row, sCol, `${colLetter(5)}${row}-${colLetter(rCol)}${row}`, dStyleYellow(dataBorderStd))
    row++
  }

  // ── Totals row (172) — T:medium|B:medium ──
  const totRow = 172
  refs.lodgementTotalRow = totRow

  // Store transfer bank column letters for cross-sheet reference in reconciliation
  const transferBankColLetters = []
  for (let i = 0; i < displayBanks.length; i++) {
    if (displayBanks[i].lodgement_type === 'transfer') {
      transferBankColLetters.push(colLetter(bankStartCol + i))
    }
  }
  refs.transferBankColLetters = transferBankColLetters
  const totBorder = { top: { style: 'medium' }, bottom: { style: 'medium' } }
  const totStyle = (align) => ({ font: FONT_10_BOLD, border: totBorder, alignment: { horizontal: align || 'center' } })

  textCell(ws, totRow, 2, 'TOTAL AMOUNT', { font: FONT_10_BOLD, border: { ...totBorder, left: { style: 'medium' } } })
  formulaCell(ws, totRow, 3, `SUM(C${dataStartRow}:C${totRow - 1})`, totStyle())
  formulaCell(ws, totRow, 5, `SUM(E${dataStartRow}:E${totRow - 1})`, totStyle())
  formulaCell(ws, totRow, 7, `SUM(G${dataStartRow}:G${totRow - 1})`, totStyle())

  for (let i = 0; i < bankCols; i++) {
    const cl = colLetter(bankStartCol + i)
    formulaCell(ws, totRow, bankStartCol + i, `SUM(${cl}${dataStartRow}:${cl}${totRow - 1})`, totStyle())
  }

  formulaCell(ws, totRow, qCol, `SUM(${colLetter(qCol)}${dataStartRow}:${colLetter(qCol)}${totRow - 1})`, totStyle())
  formulaCell(ws, totRow, rCol, `SUM(${colLetter(rCol)}${dataStartRow}:${colLetter(rCol)}${totRow - 1})`, totStyle())
  formulaCell(ws, totRow, sCol, `SUM(${colLetter(sCol)}${dataStartRow}:${colLetter(sCol)}${totRow - 1})`, { font: FONT_10_BOLD, border: { ...totBorder, right: { style: 'medium' } } })
  formulaCell(ws, totRow, tCol, `SUM(${colLetter(tCol)}${dataStartRow}:${colLetter(tCol)}${totRow - 1})`, { font: FONT_10_BOLD, border: { ...totBorder, right: { style: 'medium' } } })

  // U, V totals row — empty with borders
  ws.getRow(totRow).getCell(uCol).border = { ...totBorder, right: { style: 'medium' } }
  ws.getRow(totRow).getCell(uCol).font = FONT_10_BOLD
  ws.getRow(totRow).getCell(vCol).border = { ...totBorder, right: { style: 'medium' } }
  ws.getRow(totRow).getCell(vCol).font = FONT_10_BOLD

  // Fill D, F, H spacer columns in totals row
  for (const c of [4, 6, 8]) {
    ws.getRow(totRow).getCell(c).border = totBorder
    ws.getRow(totRow).getCell(c).font = FONT_10
  }

  // Fill grid — applies thin borders on empty cells + medium on edges
  fillGrid(ws, dataStartRow, totRow, 2, vCol, FONT_10)

  // Post-process: fix bank column borders (L:thin only, no R) and Q column (R:medium)
  for (let r = dataStartRow; r <= maxDataRow; r++) {
    for (let c = bankStartCol; c <= bankEndCol; c++) {
      const cell = ws.getRow(r).getCell(c)
      const brd = cell.border || {}
      cell.border = { ...brd, right: undefined }
      delete cell.border.right
    }
    // Q column: ensure R:medium
    const qCell = ws.getRow(r).getCell(qCol)
    qCell.border = { ...(qCell.border || {}), right: { style: 'medium' } }
  }

  // Logo — exact position from reference
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { nativeCol: 6, nativeColOff: 0, nativeRow: 1, nativeRowOff: 0 },
      br: { nativeCol: 8, nativeColOff: 567028, nativeRow: 3, nativeRowOff: 109327 },
      editAs: 'oneCell',
    })
  }

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
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })
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
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })

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
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, objects: true })

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
