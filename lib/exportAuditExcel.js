import ExcelJS from 'exceljs'

/**
 * Direct table-to-Excel export — no template.
 * Creates a fresh workbook, writes all report data as computed values,
 * and applies styling that matches the UI tables.
 */

// ─── Styling constants (matching old template) ───────────
//
// Font: Corbel throughout (Calibri on Lubricants sheet)
// Yellow fill on computed cells, no fill on input cells
// Medium borders on headers/outer, thin on data grid, double bottom on totals
// Accounting number format with dash for zero

const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }

const FONT = { name: 'Corbel', size: 11 }
const FONT_BOLD = { name: 'Corbel', size: 11, bold: true }
const FONT_BOLD_UL = { name: 'Corbel', size: 12, bold: true, underline: true }
const FONT_SM = { name: 'Corbel', size: 10 }
const FONT_SM_BOLD = { name: 'Corbel', size: 10, bold: true }
const RED_FONT = { name: 'Corbel', size: 11, bold: true, color: { argb: 'FFFF0000' } }
const RED_SM = { name: 'Corbel', size: 10, bold: true, color: { argb: 'FFFF0000' } }

// Calibri variants for Lubricants sheet
const CAL_FONT = { name: 'Calibri', size: 11 }
const CAL_BOLD = { name: 'Calibri', size: 11, bold: true }
const CAL_TITLE = { name: 'Calibri', size: 14, bold: true }

const BORDER_THIN = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
const BORDER_HDR = {
  top: { style: 'medium' }, bottom: { style: 'medium' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
const BORDER_HDR_L = { ...BORDER_HDR, left: { style: 'medium' } }
const BORDER_HDR_R = { ...BORDER_HDR, right: { style: 'medium' } }
const BORDER_TOTAL = {
  top: { style: 'thin' }, bottom: { style: 'double' },
  left: { style: 'thin' }, right: { style: 'thin' },
}

const ACCT_FMT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-'
const ACCT_FMT_2 = '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-'
const NUM_FMT = '#,##0'
const DATE_FMT = 'mm-dd-yy'

// Style builders
function hdrStyle(font) {
  return { font: font || FONT_BOLD, border: BORDER_HDR, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } }
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

function applyStyle(cell, style) {
  if (style.font) cell.font = style.font
  if (style.fill) cell.fill = style.fill
  if (style.border) cell.border = style.border
  if (style.alignment) cell.alignment = style.alignment
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
  cell.value = new Date(dateStr + 'T00:00:00')
  cell.numFmt = DATE_FMT
  applyStyle(cell, style || dataStyle('left'))
}

// ─── Main Export ──────────────────────────────────────────

export async function exportAuditExcel({
  report, receipts, lubeSales, lubeStock, lubeProducts,
  tanks, nozzles, stationName, startDate, endDate,
}) {
  if (!report) throw new Error('No report data')

  const wb = new ExcelJS.Workbook()

  const fmtDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  writeSalesCash(wb, report, stationName, startDate, endDate, fmtDate)
  writeStockSummary(wb, report, stationName, startDate, endDate, fmtDate)
  writeLodgement(wb, report, startDate, endDate)
  writeConsumption(wb, report, startDate, endDate)
  writeRecordOfStock(wb, report)
  writeProductReceived(wb, receipts, tanks, startDate, endDate)
  writeLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate, fmtDate)

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

// ─── Sheet: Sales/Cash Position (Corbel 11) ─────────────

function writeSalesCash(wb, report, stationName, startDate, endDate, fmtDate) {
  const ws = wb.addWorksheet('Sales Cash Position')
  const { salesCash, fuelTypes } = report
  if (!salesCash) return

  // Column widths (per style-summary sheet 2)
  ws.columns = [
    { width: 9.29 },  // A
    { width: 15.71 }, // B
    { width: 38 },    // C - opening / description
    { width: 22.57 }, // D - closing
    { width: 26.57 }, // E - dispensed / qty
    { width: 15.71 }, // F - price
    { width: 16.71 }, // G - amount
  ]

  let row = 1

  // Title
  textCell(ws, row, 1, stationName || '', hdrStyle(FONT_BOLD))
  ws.mergeCells(row, 1, row, 7)
  row++
  textCell(ws, row, 1, `CASH/SALES RECONCILIATION AS AT ${fmtDate(startDate)} - ${fmtDate(endDate)}`, hdrStyle(FONT_BOLD))
  ws.mergeCells(row, 1, row, 7)
  row += 2

  for (let ftIdx = 0; ftIdx < fuelTypes.length; ftIdx++) {
    const ft = fuelTypes[ftIdx]
    const summary = salesCash.fuelSummaries[ft]
    if (!summary) continue

    // Section header
    textCell(ws, row, 1, `${ftIdx + 1}. ${ft} Sales for the Period`, hdrStyle(FONT_BOLD))
    ws.mergeCells(row, 1, row, 7)
    row++

    // Meter reading header
    textCell(ws, row, 1, '', hdrStyle(FONT_BOLD))
    textCell(ws, row, 2, 'Meter Reading', hdrStyle(FONT_BOLD))
    textCell(ws, row, 3, `Opening (${fmtDate(startDate)})`, hdrStyle(FONT_BOLD))
    textCell(ws, row, 4, `Closing (${fmtDate(endDate)})`, hdrStyle(FONT_BOLD))
    textCell(ws, row, 5, 'Dispensed', hdrStyle(FONT_BOLD))
    textCell(ws, row, 6, 'Price', hdrStyle(FONT_BOLD))
    textCell(ws, row, 7, 'Amount', hdrStyle(FONT_BOLD))
    row++

    // Pump meter rows
    for (let ri = 0; ri < summary.rows.length; ri++) {
      const period = summary.rows[ri]
      if (ri > 0) row++ // spacer between price groups

      for (const pump of period.pumps) {
        textCell(ws, row, 1, '', dataStyle('left'))
        textCell(ws, row, 2, pump.label, boldStyle('left'))
        numCell(ws, row, 3, pump.opening, dataStyle(), NUM_FMT)
        numCell(ws, row, 4, pump.closing, dataStyle(), NUM_FMT)
        yellowNum(ws, row, 5, pump.dispensed, dataStyleYellow(), NUM_FMT)
        numCell(ws, row, 6, period.price, dataStyle())
        yellowNum(ws, row, 7, pump.dispensed * period.price)
        row++
      }
    }
    row++

    // A = Total Sales
    textCell(ws, row, 1, 'A', totalStyle('left'))
    textCell(ws, row, 2, `Total ${ft} Sales for the Period`, totalStyle('left'))
    textCell(ws, row, 3, '', totalStyle())
    textCell(ws, row, 4, '', totalStyle())
    yellowNum(ws, row, 5, summary.totalDispensed, totalStyle())
    textCell(ws, row, 6, '', totalStyle())
    yellowNum(ws, row, 7, summary.totalAmount, totalStyle())
    row++

    // B = Less Pour Back
    textCell(ws, row, 1, 'B', boldStyle('left'))
    textCell(ws, row, 2, `Less Pour Back on ${ft}`, boldStyle('left'))
    textCell(ws, row, 3, '', boldStyle())
    textCell(ws, row, 4, '', boldStyle())
    textCell(ws, row, 5, '', boldStyle())
    textCell(ws, row, 6, '', boldStyle())
    numCell(ws, row, 7, summary.totalPourBackAmt, boldStyle())
    row++

    // Pour back detail rows
    for (const group of (summary.consumption.pourBackByPrice || [])) {
      textCell(ws, row, 1, '', dataStyle('left'))
      textCell(ws, row, 2, group.name, dataStyle('left'))
      textCell(ws, row, 3, '', dataStyle())
      textCell(ws, row, 4, '', dataStyle())
      numCell(ws, row, 5, group.totalQty)
      numCell(ws, row, 6, group.price)
      numCell(ws, row, 7, group.totalAmt)
      row++
    }

    // C = Net Sales
    textCell(ws, row, 1, 'C=A-B', totalStyle('left'))
    textCell(ws, row, 2, `Net ${ft} Sales for the Period`, totalStyle('left'))
    textCell(ws, row, 3, '', totalStyle())
    textCell(ws, row, 4, '', totalStyle())
    yellowNum(ws, row, 5, summary.netSalesQty, totalStyle())
    textCell(ws, row, 6, '', totalStyle())
    yellowNum(ws, row, 7, summary.netSalesAmt, totalStyle())
    row++

    // Less Consumption header
    textCell(ws, row, 1, '', boldStyle('left'))
    textCell(ws, row, 2, `Less Consumption on ${ft}`, boldStyle('left'))
    ws.mergeCells(row, 2, row, 7)
    row++

    // Consumption detail rows
    for (const group of (summary.consumption.consumedByPrice || [])) {
      textCell(ws, row, 1, '', dataStyle('left'))
      textCell(ws, row, 2, group.name, dataStyle('left'))
      textCell(ws, row, 3, '', dataStyle())
      textCell(ws, row, 4, '', dataStyle())
      numCell(ws, row, 5, group.totalQty)
      numCell(ws, row, 6, group.price)
      numCell(ws, row, 7, group.totalAmt)
      row++
    }

    // D = Total Consumption
    textCell(ws, row, 1, 'D', boldStyle('left'))
    textCell(ws, row, 2, `Total Consumption of ${ft}`, boldStyle('left'))
    textCell(ws, row, 3, '', boldStyle())
    textCell(ws, row, 4, '', boldStyle())
    numCell(ws, row, 5, summary.totalConsumedQty, boldStyle())
    textCell(ws, row, 6, '', boldStyle())
    numCell(ws, row, 7, summary.totalConsumedAmt, boldStyle())
    row++

    // E = Expected Sales
    textCell(ws, row, 1, 'E=C-D', totalStyle('left'))
    textCell(ws, row, 2, `Expected ${ft} Sales`, totalStyle('left'))
    textCell(ws, row, 3, '', totalStyle())
    textCell(ws, row, 4, '', totalStyle())
    yellowNum(ws, row, 5, summary.expectedSalesQty, totalStyle())
    textCell(ws, row, 6, '', totalStyle())
    yellowNum(ws, row, 7, summary.expectedSalesAmt, totalStyle())
    row += 2
  }

  // Cash Reconciliation
  const cr = salesCash.cashReconciliation
  textCell(ws, row, 1, `Sales/Lodgement Reconciliation — ${fmtDate(startDate)} to ${fmtDate(endDate)}`, hdrStyle(FONT_BOLD))
  ws.mergeCells(row, 1, row, 7)
  row++

  const crRows = [
    ['Expected Sales from Products for the Period', cr.expectedSalesTotal, true],
    ['Total Lodgement for the Period', cr.totalLodgement, false],
    ['Total POS for the Period', cr.totalPOS, false],
    ['Total Transfer for the Period', cr.totalTransfer, false],
    ['Overage/Shortage', cr.overshort, true],
  ]
  for (const [label, value, highlight] of crRows) {
    const style = highlight ? totalStyle('left') : boldStyle('left')
    const numSty = highlight ? totalStyle() : boldStyle()
    textCell(ws, row, 1, label, style)
    ws.mergeCells(row, 1, row, 6)
    numCell(ws, row, 7, value, numSty)
    if (label === 'Overage/Shortage' && value < 0) {
      ws.getRow(row).getCell(7).font = RED_FONT
    }
    row++
  }
}

// ─── Sheet: Stock Position (Corbel 12 title, 11 data) ────

function writeStockSummary(wb, report, stationName, startDate, endDate, fmtDate) {
  const ws = wb.addWorksheet('Stock Position')
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return

  // Style-summary sheet 3: B=6.29, C=73, D-J vary 11-17
  ws.columns = [{ width: 6.29 }, { width: 73 }, ...Array(8).fill({ width: 14 })]

  const FONT_12B = { name: 'Corbel', size: 12, bold: true }
  const FONT_12BU = { name: 'Corbel', size: 12, bold: true, underline: true }

  let row = 1
  textCell(ws, row, 2, `STOCK POSITION FOR THE PERIOD (${fmtDate(startDate)} - ${fmtDate(endDate)})`, { font: FONT_12BU, border: BORDER_HDR, alignment: { horizontal: 'center' } })
  ws.mergeCells(row, 2, row, 4)
  row += 2

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const t = data.totals
    const stockAvailable = t.opening + t.supply

    // Section header
    textCell(ws, row, 2, `${ft} STOCK POSITION`, hdrStyle(FONT_12B))
    textCell(ws, row, 3, "Per Manager's Computation", hdrStyle(FONT_12B))
    row++

    const items = [
      [`OPENING STOCK (${fmtDate(startDate)})`, t.opening, false],
      ['SUPPLIES DURING THE PERIOD', t.supply, false],
      ['STOCK AVAILABLE FOR SALE', stockAvailable, true],
      [`CLOSING STOCK (${fmtDate(endDate)})`, t.closing, false],
      ['QUANTITY SOLD', t.qtySold, false],
      ['QUANTITY DISPENSED', t.dispensed, false],
      ['OVERAGE/(SHORTAGE)', t.ovsh, true],
      ['', '', false],
      ['EXPECTED LITRES', t.expectedLitres, false],
      ['ACTUAL LITRES RECEIVED', t.actualLitresReceived, false],
      ['OVERAGE/(SHORTAGE) - TRUCK DRIVER', t.truckDriverOvsh, true],
    ]

    for (const [label, value, isBold] of items) {
      const style = isBold ? boldStyle('left') : dataStyle('left')
      const numSty = isBold ? boldStyle() : dataStyle()
      textCell(ws, row, 2, label, style)
      if (label.startsWith('OVERAGE')) {
        numCell(ws, row, 3, value, numSty)
        if (value != null && value < 0) ws.getRow(row).getCell(3).font = RED_FONT
      } else if (label === '') {
        textCell(ws, row, 3, '', dataStyle())
      } else {
        numCell(ws, row, 3, value, numSty)
      }
      row++
    }
    row++
  }
}

// ─── Sheet: Lodgement (Corbel 10) ────────────────────────

function writeLodgement(wb, report, startDate, endDate) {
  const ws = wb.addWorksheet('Lodgement Sheet')
  const { lodgementSheet } = report
  if (!lodgementSheet) return

  const { rows, banks, totals } = lodgementSheet
  const posBanks = banks.filter(b => b.lodgement_type === 'pos')
  const transferBanks = banks.filter(b => b.lodgement_type === 'transfer')
  const displayBanks = banks.filter(b => b.lodgement_type === 'pos' || b.lodgement_type === 'transfer')

  const fixedCols = 4
  const bankCount = displayBanks.length
  const afterBanks = 5
  const totalCols = fixedCols + bankCount + afterBanks

  const colWidths = [
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 },
    ...displayBanks.map(() => ({ width: 14 })),
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]
  ws.columns = colWidths

  let row = 1

  // Title
  textCell(ws, row, 1, 'LODGEMENT', hdrStyle(FONT_SM_BOLD))
  ws.mergeCells(row, 1, row, totalCols)
  row++

  // Headers row 1
  const headers = ['Sales Date', 'Total Sales', 'Cash Sales', 'Credit']
  for (let i = 0; i < headers.length; i++) textCell(ws, row, i + 1, headers[i], hdrStyle(FONT_SM_BOLD))

  if (bankCount > 0) {
    textCell(ws, row, fixedCols + 1, 'Analysis of POS by Banks', hdrStyle(FONT_SM_BOLD))
    if (bankCount > 1) ws.mergeCells(row, fixedCols + 1, row, fixedCols + bankCount)
  }

  const postHeaders = ['Total POS', 'Total Transfer', 'Expected', 'Actual', 'OV/SH']
  for (let i = 0; i < postHeaders.length; i++) {
    textCell(ws, row, fixedCols + bankCount + i + 1, postHeaders[i], hdrStyle(FONT_SM_BOLD))
  }
  row++

  // Bank name sub-headers
  if (bankCount > 0) {
    for (let i = 0; i < fixedCols; i++) textCell(ws, row, i + 1, '', hdrStyle(FONT_SM_BOLD))
    for (let i = 0; i < displayBanks.length; i++) {
      const label = displayBanks[i].bank_name + (displayBanks[i].lodgement_type === 'transfer' ? ' (T)' : '')
      textCell(ws, row, fixedCols + i + 1, label, hdrStyle(FONT_SM_BOLD))
    }
    for (let i = 0; i < afterBanks; i++) textCell(ws, row, fixedCols + bankCount + i + 1, '', hdrStyle(FONT_SM_BOLD))
    row++
  }

  // Data rows
  const sumBanks = (amounts, list) => list.reduce((s, b) => s + (amounts[b.id] || 0), 0)
  const visibleRows = rows.filter(r => r.hasData)

  for (const r of visibleRows) {
    const tPOS = sumBanks(r.bankAmounts, posBanks)
    const tTransfer = sumBanks(r.bankAmounts, transferBanks)
    const cashSales = r.totalSales - tPOS - tTransfer

    dateCell(ws, row, 1, r.date, dataStyle('left', FONT_SM))
    numCell(ws, row, 2, r.totalSales, dataStyle('center', FONT_SM))
    yellowNum(ws, row, 3, cashSales, dataStyleYellow('center', FONT_SM))
    textCell(ws, row, 4, '', dataStyle('center', FONT_SM))

    for (let i = 0; i < displayBanks.length; i++) {
      numCell(ws, row, fixedCols + i + 1, r.bankAmounts[displayBanks[i].id] || 0, dataStyle('center', FONT_SM))
    }

    numCell(ws, row, fixedCols + bankCount + 1, tPOS, dataStyle('center', FONT_SM))
    numCell(ws, row, fixedCols + bankCount + 2, tTransfer, dataStyle('center', FONT_SM))
    yellowNum(ws, row, fixedCols + bankCount + 3, cashSales, dataStyleYellow('center', FONT_SM))
    numCell(ws, row, fixedCols + bankCount + 4, r.actual, dataStyle('center', FONT_SM))

    const ovshCell = ws.getRow(row).getCell(fixedCols + bankCount + 5)
    ovshCell.value = r.ovsh || ''
    ovshCell.numFmt = NUM_FMT
    applyStyle(ovshCell, boldStyle('center', FONT_SM_BOLD))
    if (r.ovsh && r.ovsh !== 0) ovshCell.font = RED_SM
    row++
  }

  // Totals row
  if (visibleRows.length > 0) {
    const gPOS = sumBanks(totals.bankTotals, posBanks)
    const gTransfer = sumBanks(totals.bankTotals, transferBanks)
    const gCash = totals.totalSales - gPOS - gTransfer

    textCell(ws, row, 1, 'Total', totalStyle('left', FONT_SM_BOLD))
    numCell(ws, row, 2, totals.totalSales, totalStyle('center', FONT_SM_BOLD))
    yellowNum(ws, row, 3, gCash, { font: FONT_SM_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } })
    textCell(ws, row, 4, '', totalStyle('center', FONT_SM_BOLD))

    for (let i = 0; i < displayBanks.length; i++) {
      numCell(ws, row, fixedCols + i + 1, totals.bankTotals[displayBanks[i].id] || 0, totalStyle('center', FONT_SM_BOLD))
    }

    numCell(ws, row, fixedCols + bankCount + 1, gPOS, totalStyle('center', FONT_SM_BOLD))
    numCell(ws, row, fixedCols + bankCount + 2, gTransfer, totalStyle('center', FONT_SM_BOLD))
    yellowNum(ws, row, fixedCols + bankCount + 3, gCash, { font: FONT_SM_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } })
    numCell(ws, row, fixedCols + bankCount + 4, totals.actual, totalStyle('center', FONT_SM_BOLD))
    numCell(ws, row, fixedCols + bankCount + 5, totals.ovsh, totalStyle('center', FONT_SM_BOLD))
  }
}

// ─── Sheets: Consumption & Pour Back (Corbel 10) ─────────

function writeConsumption(wb, report, startDate, endDate) {
  const { consumptionReport, fuelTypes } = report
  if (!consumptionReport) return

  for (const ft of fuelTypes) {
    const data = consumptionReport[ft]
    if (!data) continue
    const { customers, rows, totals } = data

    const ws = wb.addWorksheet(`${ft} Consumption`)

    const colWidths = [{ width: 14 }, { width: 12 }, ...customers.map(() => ({ width: 14 })), { width: 14 }]
    ws.columns = colWidths

    let row = 1

    // Header
    textCell(ws, row, 1, 'Date', hdrStyle(FONT_SM_BOLD))
    textCell(ws, row, 2, 'Rate (N)', hdrStyle(FONT_SM_BOLD))
    for (let i = 0; i < customers.length; i++) {
      textCell(ws, row, 3 + i, customers[i].name, hdrStyle(FONT_SM_BOLD))
    }
    textCell(ws, row, 3 + customers.length, 'Pour Back', hdrStyle(FONT_SM_BOLD))
    row++

    // Data rows
    for (const r of rows) {
      dateCell(ws, row, 1, r.date, dataStyle('left', FONT_SM))
      numCell(ws, row, 2, r.rate, dataStyle('center', FONT_SM))
      for (let i = 0; i < customers.length; i++) {
        numCell(ws, row, 3 + i, r.customerQtys[customers[i].id] || 0, dataStyle('center', FONT_SM))
      }
      numCell(ws, row, 3 + customers.length, r.pourBack || 0, dataStyle('center', FONT_SM))
      row++
    }

    // Totals row
    textCell(ws, row, 1, 'Total', totalStyle('left', FONT_SM_BOLD))
    textCell(ws, row, 2, '', totalStyle('center', FONT_SM_BOLD))
    for (let i = 0; i < customers.length; i++) {
      numCell(ws, row, 3 + i, totals.customerTotals[customers[i].id] || 0, totalStyle('center', FONT_SM_BOLD))
    }
    numCell(ws, row, 3 + customers.length, totals.pourBack || 0, totalStyle('center', FONT_SM_BOLD))
  }
}

// ─── Sheet: Record of Stock Position (Corbel 10) ─────────

function writeRecordOfStock(wb, report) {
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue

    const ws = wb.addWorksheet(`${ft} Stock Record`)
    ws.columns = [
      { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 },
      { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
    ]

    let row = 1

    // Title
    textCell(ws, row, 1, `RECORD OF STOCK POSITION — ${ft}`, hdrStyle(FONT_BOLD))
    ws.mergeCells(row, 1, row, 8)
    row++

    // Header
    const headers = ['Date', 'Opening Stock', 'Product Supplied', 'Qty Sold', 'Closing Stock', 'OV/SH', 'Actual OV/SH', 'VARIANCE']
    for (let i = 0; i < headers.length; i++) {
      textCell(ws, row, i + 1, headers[i], hdrStyle(FONT_SM_BOLD))
    }
    row++

    // Data rows
    const visibleRows = data.rows.filter(r => r.hasData)
    for (const r of visibleRows) {
      dateCell(ws, row, 1, r.date, dataStyle('left', FONT_SM))
      numCell(ws, row, 2, r.opening, dataStyle('center', FONT_SM))
      numCell(ws, row, 3, r.supply, dataStyle('center', FONT_SM))
      yellowNum(ws, row, 4, r.qtySold, dataStyleYellow('center', FONT_SM))
      numCell(ws, row, 5, r.closing, dataStyle('center', FONT_SM))
      yellowNum(ws, row, 6, r.ovsh, dataStyleYellow('center', FONT_SM))
      numCell(ws, row, 7, r.actualOvsh, dataStyle('center', FONT_SM))
      textCell(ws, row, 8, '', dataStyle('center', FONT_SM))
      row++
    }

    // Totals
    if (visibleRows.length > 0) {
      const t = data.totals
      textCell(ws, row, 1, 'Total', totalStyle('left', FONT_SM_BOLD))
      numCell(ws, row, 2, t.opening, totalStyle('center', FONT_SM_BOLD))
      numCell(ws, row, 3, t.supply, totalStyle('center', FONT_SM_BOLD))
      yellowNum(ws, row, 4, t.qtySold, { font: FONT_SM_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } })
      numCell(ws, row, 5, t.closing, totalStyle('center', FONT_SM_BOLD))
      yellowNum(ws, row, 6, t.ovsh, { font: FONT_SM_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } })
      numCell(ws, row, 7, t.actualOvsh, totalStyle('center', FONT_SM_BOLD))
      textCell(ws, row, 8, '', totalStyle('center', FONT_SM_BOLD))
    }
  }
}

// ─── Sheet: Product Received (Corbel 10/11 mixed) ────────

function writeProductReceived(wb, receipts, tanks, startDate, endDate) {
  const ws = wb.addWorksheet('Product Received')

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

  // Narrow spacer columns (E=1.43, G=2.29 per style-summary)
  ws.columns = [
    { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
  ]

  let row = 1

  // Title
  textCell(ws, row, 1, 'PRODUCT RECEIVED', hdrStyle(FONT_BOLD))
  ws.mergeCells(row, 1, row, 11)
  row++

  // Headers
  const headers = ['Date', '', 'PMS Expected', 'PMS Actual', 'PMS OV/SH',
    'AGO Expected', 'AGO Actual', 'AGO OV/SH',
    'DPK Expected', 'DPK Actual', 'DPK OV/SH']
  for (let i = 0; i < headers.length; i++) {
    textCell(ws, row, i + 1, headers[i], hdrStyle(FONT_SM_BOLD))
  }
  row++

  // Data
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

    dateCell(ws, row, 1, date, dataStyle('left', FONT_SM))
    dateCell(ws, row, 2, date, dataStyle('left', FONT_SM))
    numCell(ws, row, 3, pmsExp || '', dataStyle('center', FONT_SM), ACCT_FMT_2)
    numCell(ws, row, 4, pmsAct || '', dataStyle('center', FONT_SM), ACCT_FMT_2)
    yellowNum(ws, row, 5, pmsAct - pmsExp || '', dataStyleYellow('center', FONT_SM), ACCT_FMT_2)
    numCell(ws, row, 6, agoExp || '', dataStyle('center', FONT_SM), ACCT_FMT_2)
    numCell(ws, row, 7, agoAct || '', dataStyle('center', FONT_SM), ACCT_FMT_2)
    yellowNum(ws, row, 8, agoAct - agoExp || '', dataStyleYellow('center', FONT_SM), ACCT_FMT_2)
    numCell(ws, row, 9, dpkExp || '', dataStyle('center', FONT_SM), ACCT_FMT_2)
    numCell(ws, row, 10, dpkAct || '', dataStyle('center', FONT_SM), ACCT_FMT_2)
    yellowNum(ws, row, 11, dpkAct - dpkExp || '', dataStyleYellow('center', FONT_SM), ACCT_FMT_2)
    row++
  }

  // Totals
  if (dates.length > 0) {
    let tPmsE = 0, tPmsA = 0, tAgoE = 0, tAgoA = 0, tDpkE = 0, tDpkA = 0
    for (const date of dates) {
      for (const e of byDate[date]) {
        const ft = tankFuel[e.tankId]
        const expected = Number(e.firstCompartment || 0) + Number(e.secondCompartment || 0) + Number(e.thirdCompartment || 0)
        const actual = Number(e.actualVolume || 0)
        if (ft === 'PMS') { tPmsE += expected; tPmsA += actual }
        else if (ft === 'AGO') { tAgoE += expected; tAgoA += actual }
        else if (ft === 'DPK') { tDpkE += expected; tDpkA += actual }
      }
    }
    const ts = (f) => totalStyle('center', f || FONT_SM_BOLD)
    const tsY = { font: FONT_SM_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } }
    textCell(ws, row, 1, 'Total', totalStyle('left', FONT_SM_BOLD))
    textCell(ws, row, 2, '', ts())
    numCell(ws, row, 3, tPmsE, ts(), ACCT_FMT_2)
    numCell(ws, row, 4, tPmsA, ts(), ACCT_FMT_2)
    yellowNum(ws, row, 5, tPmsA - tPmsE, tsY, ACCT_FMT_2)
    numCell(ws, row, 6, tAgoE, ts(), ACCT_FMT_2)
    numCell(ws, row, 7, tAgoA, ts(), ACCT_FMT_2)
    yellowNum(ws, row, 8, tAgoA - tAgoE, tsY, ACCT_FMT_2)
    numCell(ws, row, 9, tDpkE, ts(), ACCT_FMT_2)
    numCell(ws, row, 10, tDpkA, ts(), ACCT_FMT_2)
    yellowNum(ws, row, 11, tDpkA - tDpkE, tsY, ACCT_FMT_2)
  }
}

// ─── Sheet: Lubricants (Calibri) ─────────────────────────

function writeLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate, fmtDate) {
  const ws = wb.addWorksheet('Castro Lubricants')

  ws.columns = [
    { width: 6 },  // S/N
    { width: 10 }, // Size
    { width: 28 }, // Product
    { width: 6 },  // Unit
    { width: 12 }, // Opening
    { width: 12 }, // Purchase
    { width: 12 }, // Units Sold
    { width: 12 }, // Closing
    { width: 12 }, // Unit Price
    { width: 14 }, // Value
  ]

  let row = 1

  // Title (Calibri 14 bold)
  textCell(ws, row, 1, `LUBRICANTS AS AT ${fmtDate(endDate)} - ${stationName || ''}`, { font: CAL_TITLE, border: BORDER_HDR, alignment: { horizontal: 'center' } })
  ws.mergeCells(row, 1, row, 10)
  row++

  // Headers (Calibri 11 bold)
  const headers = ['S/N', 'Size', 'Product', 'Unit', 'Opening', 'Purchase', 'Units Sold', 'Closing', 'Unit Price', 'Value']
  for (let i = 0; i < headers.length; i++) {
    textCell(ws, row, i + 1, headers[i], hdrStyle(CAL_BOLD))
  }
  row++

  if (!lubeProducts?.length) return

  const products = [...lubeProducts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const stockSorted = [...(lubeStock || [])].sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  let totalOpening = 0, totalPurchase = 0, totalSold = 0, totalClosing = 0, totalValue = 0

  for (let idx = 0; idx < products.length; idx++) {
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
    const unitsSold = openingStock + purchase - closingStock
    const value = unitsSold * unitPrice

    totalOpening += openingStock
    totalPurchase += purchase
    totalSold += unitsSold
    totalClosing += closingStock
    totalValue += value

    textCell(ws, row, 1, idx + 1, dataStyle('center', CAL_FONT))
    textCell(ws, row, 2, prod.size || '', dataStyle('center', CAL_FONT))
    textCell(ws, row, 3, prod.product_name || '', dataStyle('left', CAL_FONT))
    textCell(ws, row, 4, prod.unit || 'pcs', dataStyle('center', CAL_FONT))
    numCell(ws, row, 5, openingStock, dataStyle('center', CAL_FONT))
    numCell(ws, row, 6, purchase, dataStyle('center', CAL_FONT))
    yellowNum(ws, row, 7, unitsSold, dataStyleYellow('center', CAL_FONT))
    numCell(ws, row, 8, closingStock, dataStyle('center', CAL_FONT))
    numCell(ws, row, 9, unitPrice, dataStyle('center', CAL_FONT), ACCT_FMT_2)
    yellowNum(ws, row, 10, value, dataStyleYellow('center', CAL_FONT), ACCT_FMT_2)
    row++
  }

  // Totals (Calibri 11 bold, double bottom border)
  textCell(ws, row, 1, '', totalStyle('center', CAL_BOLD))
  textCell(ws, row, 2, '', totalStyle('center', CAL_BOLD))
  textCell(ws, row, 3, 'TOTAL', totalStyle('left', CAL_BOLD))
  textCell(ws, row, 4, '', totalStyle('center', CAL_BOLD))
  numCell(ws, row, 5, totalOpening, totalStyle('center', CAL_BOLD))
  numCell(ws, row, 6, totalPurchase, totalStyle('center', CAL_BOLD))
  yellowNum(ws, row, 7, totalSold, { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } })
  numCell(ws, row, 8, totalClosing, totalStyle('center', CAL_BOLD))
  textCell(ws, row, 9, '', totalStyle('center', CAL_BOLD))
  yellowNum(ws, row, 10, totalValue, { font: CAL_BOLD, fill: YELLOW_FILL, border: BORDER_TOTAL, alignment: { horizontal: 'center' } }, ACCT_FMT_2)
}
