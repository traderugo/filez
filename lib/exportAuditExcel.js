import ExcelJS from 'exceljs'

/**
 * Direct table-to-Excel export — no template.
 * Creates a fresh workbook, writes all report data as computed values,
 * and applies styling that matches the UI tables.
 */

// ─── Styling constants ────────────────────────────────────

const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
const LIGHT_BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
const WHITE_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
const BOLD_FONT = { bold: true, size: 10 }
const NORMAL_FONT = { size: 10 }
const RED_FONT = { bold: true, color: { argb: 'FFDC2626' }, size: 10 }
const THIN_BORDER = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
}
const NUM_FMT = '#,##0'
const NUM_FMT_2 = '#,##0.00'

function hdrStyle() { return { font: WHITE_FONT, fill: BLUE_FILL, border: THIN_BORDER, alignment: { horizontal: 'center' } } }
function subHdrStyle(align = 'right') { return { font: BOLD_FONT, fill: LIGHT_BLUE_FILL, border: THIN_BORDER, alignment: { horizontal: align } } }
function cellStyle(align = 'right') { return { font: NORMAL_FONT, border: THIN_BORDER, alignment: { horizontal: align } } }
function boldCellStyle(align = 'right') { return { font: BOLD_FONT, border: THIN_BORDER, alignment: { horizontal: align } } }

function applyStyle(cell, style) {
  if (style.font) cell.font = style.font
  if (style.fill) cell.fill = style.fill
  if (style.border) cell.border = style.border
  if (style.alignment) cell.alignment = style.alignment
}

function numCell(ws, r, c, value, style) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = value ?? ''
  cell.numFmt = NUM_FMT
  applyStyle(cell, style || cellStyle())
}

function textCell(ws, r, c, value, style) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = value ?? ''
  applyStyle(cell, style || cellStyle('left'))
}

function dateCell(ws, r, c, dateStr, style) {
  const cell = ws.getRow(r).getCell(c)
  cell.value = new Date(dateStr + 'T00:00:00')
  cell.numFmt = 'DD/MM/YYYY'
  applyStyle(cell, style || cellStyle('left'))
}

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n)
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

// ─── Sheet: Sales/Cash Position ───────────────────────────

function writeSalesCash(wb, report, stationName, startDate, endDate, fmtDate) {
  const ws = wb.addWorksheet('Sales Cash Position')
  const { salesCash, fuelTypes } = report
  if (!salesCash) return

  // Column widths
  ws.columns = [
    { width: 5 },   // A - row label (A/B/C/D/E)
    { width: 18 },  // B - description / pump label
    { width: 16 },  // C - opening
    { width: 16 },  // D - closing
    { width: 16 },  // E - dispensed / qty
    { width: 14 },  // F - price
    { width: 18 },  // G - amount
  ]

  let row = 1

  // Title
  textCell(ws, row, 1, stationName || '', hdrStyle())
  ws.mergeCells(row, 1, row, 7)
  ws.getRow(row).getCell(1).alignment = { horizontal: 'center' }
  row++
  textCell(ws, row, 1, `CASH/SALES RECONCILIATION AS AT ${fmtDate(startDate)} - ${fmtDate(endDate)}`, hdrStyle())
  ws.mergeCells(row, 1, row, 7)
  ws.getRow(row).getCell(1).alignment = { horizontal: 'center' }
  row += 2

  for (let ftIdx = 0; ftIdx < fuelTypes.length; ftIdx++) {
    const ft = fuelTypes[ftIdx]
    const summary = salesCash.fuelSummaries[ft]
    if (!summary) continue

    // Section header
    textCell(ws, row, 1, `${ftIdx + 1}. ${ft} Sales for the Period`, hdrStyle())
    ws.mergeCells(row, 1, row, 7)
    row++

    // Meter reading header
    textCell(ws, row, 1, '', subHdrStyle('left'))
    textCell(ws, row, 2, 'Meter Reading', subHdrStyle('left'))
    textCell(ws, row, 3, `Opening (${fmtDate(startDate)})`, subHdrStyle())
    textCell(ws, row, 4, `Closing (${fmtDate(endDate)})`, subHdrStyle())
    textCell(ws, row, 5, 'Dispensed', subHdrStyle())
    textCell(ws, row, 6, 'Price', subHdrStyle())
    textCell(ws, row, 7, 'Amount', subHdrStyle())
    row++

    // Pump meter rows
    for (let ri = 0; ri < summary.rows.length; ri++) {
      const period = summary.rows[ri]
      if (ri > 0) row++ // spacer between price groups

      for (const pump of period.pumps) {
        textCell(ws, row, 1, '', cellStyle('left'))
        textCell(ws, row, 2, pump.label, boldCellStyle('left'))
        numCell(ws, row, 3, pump.opening)
        numCell(ws, row, 4, pump.closing)
        numCell(ws, row, 5, pump.dispensed)
        numCell(ws, row, 6, period.price)
        numCell(ws, row, 7, pump.dispensed * period.price)
        row++
      }
    }
    row++

    // A = Total Sales
    textCell(ws, row, 1, 'A', subHdrStyle('left'))
    textCell(ws, row, 2, `Total ${ft} Sales for the Period`, subHdrStyle('left'))
    textCell(ws, row, 3, '', subHdrStyle())
    textCell(ws, row, 4, '', subHdrStyle())
    numCell(ws, row, 5, summary.totalDispensed, subHdrStyle())
    textCell(ws, row, 6, '', subHdrStyle())
    numCell(ws, row, 7, summary.totalAmount, subHdrStyle())
    row++

    // B = Less Pour Back
    textCell(ws, row, 1, 'B', boldCellStyle('left'))
    textCell(ws, row, 2, `Less Pour Back on ${ft}`, boldCellStyle('left'))
    textCell(ws, row, 3, '', boldCellStyle())
    textCell(ws, row, 4, '', boldCellStyle())
    textCell(ws, row, 5, '', boldCellStyle())
    textCell(ws, row, 6, '', boldCellStyle())
    numCell(ws, row, 7, summary.totalPourBackAmt, boldCellStyle())
    row++

    // Pour back detail rows
    for (const group of (summary.consumption.pourBackByPrice || [])) {
      textCell(ws, row, 1, '', cellStyle('left'))
      textCell(ws, row, 2, group.name, cellStyle('left'))
      textCell(ws, row, 3, '', cellStyle())
      textCell(ws, row, 4, '', cellStyle())
      numCell(ws, row, 5, group.totalQty)
      numCell(ws, row, 6, group.price)
      numCell(ws, row, 7, group.totalAmt)
      row++
    }

    // C = Net Sales
    textCell(ws, row, 1, 'C=A-B', subHdrStyle('left'))
    textCell(ws, row, 2, `Net ${ft} Sales for the Period`, subHdrStyle('left'))
    textCell(ws, row, 3, '', subHdrStyle())
    textCell(ws, row, 4, '', subHdrStyle())
    numCell(ws, row, 5, summary.netSalesQty, subHdrStyle())
    textCell(ws, row, 6, '', subHdrStyle())
    numCell(ws, row, 7, summary.netSalesAmt, subHdrStyle())
    row++

    // Less Consumption header
    textCell(ws, row, 1, '', boldCellStyle('left'))
    textCell(ws, row, 2, `Less Consumption on ${ft}`, boldCellStyle('left'))
    ws.mergeCells(row, 2, row, 7)
    row++

    // Consumption detail rows
    for (const group of (summary.consumption.consumedByPrice || [])) {
      textCell(ws, row, 1, '', cellStyle('left'))
      textCell(ws, row, 2, group.name, cellStyle('left'))
      textCell(ws, row, 3, '', cellStyle())
      textCell(ws, row, 4, '', cellStyle())
      numCell(ws, row, 5, group.totalQty)
      numCell(ws, row, 6, group.price)
      numCell(ws, row, 7, group.totalAmt)
      row++
    }

    // D = Total Consumption
    textCell(ws, row, 1, 'D', boldCellStyle('left'))
    textCell(ws, row, 2, `Total Consumption of ${ft}`, boldCellStyle('left'))
    textCell(ws, row, 3, '', boldCellStyle())
    textCell(ws, row, 4, '', boldCellStyle())
    numCell(ws, row, 5, summary.totalConsumedQty, boldCellStyle())
    textCell(ws, row, 6, '', boldCellStyle())
    numCell(ws, row, 7, summary.totalConsumedAmt, boldCellStyle())
    row++

    // E = Expected Sales
    textCell(ws, row, 1, 'E=C-D', subHdrStyle('left'))
    textCell(ws, row, 2, `Expected ${ft} Sales`, subHdrStyle('left'))
    textCell(ws, row, 3, '', subHdrStyle())
    textCell(ws, row, 4, '', subHdrStyle())
    numCell(ws, row, 5, summary.expectedSalesQty, subHdrStyle())
    textCell(ws, row, 6, '', subHdrStyle())
    numCell(ws, row, 7, summary.expectedSalesAmt, subHdrStyle())
    row += 2
  }

  // Cash Reconciliation
  const cr = salesCash.cashReconciliation
  textCell(ws, row, 1, `Sales/Lodgement Reconciliation — ${fmtDate(startDate)} to ${fmtDate(endDate)}`, hdrStyle())
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
    const style = highlight ? subHdrStyle('left') : boldCellStyle('left')
    const numSty = highlight ? subHdrStyle() : boldCellStyle()
    textCell(ws, row, 1, label, style)
    ws.mergeCells(row, 1, row, 6)
    numCell(ws, row, 7, value, numSty)
    if (label === 'Overage/Shortage' && value < 0) {
      ws.getRow(row).getCell(7).font = RED_FONT
    }
    row++
  }
}

// ─── Sheet: Stock Position (Summary) ──────────────────────

function writeStockSummary(wb, report, stationName, startDate, endDate, fmtDate) {
  const ws = wb.addWorksheet('Stock Position')
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return

  ws.columns = [{ width: 45 }, { width: 22 }]

  let row = 1
  textCell(ws, row, 1, `STOCK POSITION FOR THE PERIOD (${fmtDate(startDate)} - ${fmtDate(endDate)})`, hdrStyle())
  ws.mergeCells(row, 1, row, 2)
  row += 2

  const fmtOvsh = (n) => {
    if (n == null || isNaN(n)) return ''
    return n < 0 ? `(${Math.abs(n).toLocaleString()})` : Number(n)
  }

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const t = data.totals
    const stockAvailable = t.opening + t.supply

    // Header
    textCell(ws, row, 1, `${ft} STOCK POSITION`, hdrStyle())
    textCell(ws, row, 2, "Per Manager's Computation", hdrStyle())
    row++

    const items = [
      [`OPENING STOCK (${fmtDate(startDate)})`, t.opening],
      ['SUPPLIES DURING THE PERIOD', t.supply],
      ['STOCK AVAILABLE FOR SALE', stockAvailable],
      [`CLOSING STOCK (${fmtDate(endDate)})`, t.closing],
      ['QUANTITY SOLD', t.qtySold],
      ['QUANTITY DISPENSED', t.dispensed],
      ['OVERAGE/(SHORTAGE)', t.ovsh],
      ['', ''],
      ['EXPECTED LITRES', t.expectedLitres],
      ['ACTUAL LITRES RECEIVED', t.actualLitresReceived],
      ['OVERAGE/(SHORTAGE) - TRUCK DRIVER', t.truckDriverOvsh],
    ]

    for (const [label, value] of items) {
      const isBold = ['STOCK AVAILABLE FOR SALE'].includes(label) || label.startsWith('OVERAGE')
      const style = isBold ? boldCellStyle('left') : cellStyle('left')
      textCell(ws, row, 1, label, style)
      if (label.startsWith('OVERAGE')) {
        const v = fmtOvsh(value)
        if (typeof v === 'number') {
          numCell(ws, row, 2, v, isBold ? boldCellStyle() : cellStyle())
        } else {
          textCell(ws, row, 2, v, isBold ? boldCellStyle() : cellStyle())
        }
      } else if (label === '') {
        textCell(ws, row, 2, '', cellStyle())
      } else {
        numCell(ws, row, 2, value, isBold ? boldCellStyle() : cellStyle())
      }
      row++
    }
    row++
  }
}

// ─── Sheet: Lodgement ─────────────────────────────────────

function writeLodgement(wb, report, startDate, endDate) {
  const ws = wb.addWorksheet('Lodgement Sheet')
  const { lodgementSheet } = report
  if (!lodgementSheet) return

  const { rows, banks, totals } = lodgementSheet
  const posBanks = banks.filter(b => b.lodgement_type === 'pos')
  const transferBanks = banks.filter(b => b.lodgement_type === 'transfer')
  const displayBanks = banks.filter(b => b.lodgement_type === 'pos' || b.lodgement_type === 'transfer')

  // Columns: Date | Total Sales | Cash Sales | Credit | ...banks... | Total POS | Total Transfer | Expected | Actual | OV/SH
  const fixedCols = 4 // date, total sales, cash, credit
  const bankCount = displayBanks.length
  const afterBanks = 5 // total POS, total transfer, expected, actual, OV/SH
  const totalCols = fixedCols + bankCount + afterBanks

  const colWidths = [
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 },
    ...displayBanks.map(() => ({ width: 14 })),
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]
  ws.columns = colWidths

  let row = 1

  // Title
  textCell(ws, row, 1, 'LODGEMENT', hdrStyle())
  ws.mergeCells(row, 1, row, totalCols)
  row++

  // Headers row 1
  const headers = ['Sales Date', 'Total Sales', 'Cash Sales', 'Credit']
  for (let i = 0; i < headers.length; i++) textCell(ws, row, i + 1, headers[i], subHdrStyle('center'))

  if (bankCount > 0) {
    textCell(ws, row, fixedCols + 1, 'Analysis of POS by Banks', subHdrStyle('center'))
    if (bankCount > 1) ws.mergeCells(row, fixedCols + 1, row, fixedCols + bankCount)
  }

  const postHeaders = ['Total POS', 'Total Transfer', 'Expected', 'Actual', 'OV/SH']
  for (let i = 0; i < postHeaders.length; i++) {
    textCell(ws, row, fixedCols + bankCount + i + 1, postHeaders[i], subHdrStyle('center'))
  }
  row++

  // Bank name sub-headers
  if (bankCount > 0) {
    for (let i = 0; i < fixedCols; i++) textCell(ws, row, i + 1, '', subHdrStyle('center'))
    for (let i = 0; i < displayBanks.length; i++) {
      const label = displayBanks[i].bank_name + (displayBanks[i].lodgement_type === 'transfer' ? ' (T)' : '')
      textCell(ws, row, fixedCols + i + 1, label, subHdrStyle('center'))
    }
    for (let i = 0; i < afterBanks; i++) textCell(ws, row, fixedCols + bankCount + i + 1, '', subHdrStyle('center'))
    row++
  }

  // Data rows
  const sumBanks = (amounts, list) => list.reduce((s, b) => s + (amounts[b.id] || 0), 0)
  const visibleRows = rows.filter(r => r.hasData)

  for (const r of visibleRows) {
    const tPOS = sumBanks(r.bankAmounts, posBanks)
    const tTransfer = sumBanks(r.bankAmounts, transferBanks)
    const cashSales = r.totalSales - tPOS - tTransfer

    dateCell(ws, row, 1, r.date)
    numCell(ws, row, 2, r.totalSales)
    numCell(ws, row, 3, cashSales)
    textCell(ws, row, 4, '', cellStyle())

    for (let i = 0; i < displayBanks.length; i++) {
      numCell(ws, row, fixedCols + i + 1, r.bankAmounts[displayBanks[i].id] || 0)
    }

    numCell(ws, row, fixedCols + bankCount + 1, tPOS)
    numCell(ws, row, fixedCols + bankCount + 2, tTransfer)
    numCell(ws, row, fixedCols + bankCount + 3, cashSales)
    numCell(ws, row, fixedCols + bankCount + 4, r.actual)

    const ovshCell = ws.getRow(row).getCell(fixedCols + bankCount + 5)
    ovshCell.value = r.ovsh || ''
    ovshCell.numFmt = NUM_FMT
    applyStyle(ovshCell, boldCellStyle())
    if (r.ovsh && r.ovsh !== 0) ovshCell.font = RED_FONT
    row++
  }

  // Totals row
  if (visibleRows.length > 0) {
    const gPOS = sumBanks(totals.bankTotals, posBanks)
    const gTransfer = sumBanks(totals.bankTotals, transferBanks)
    const gCash = totals.totalSales - gPOS - gTransfer

    textCell(ws, row, 1, 'Total', subHdrStyle('left'))
    numCell(ws, row, 2, totals.totalSales, subHdrStyle())
    numCell(ws, row, 3, gCash, subHdrStyle())
    textCell(ws, row, 4, '', subHdrStyle())

    for (let i = 0; i < displayBanks.length; i++) {
      numCell(ws, row, fixedCols + i + 1, totals.bankTotals[displayBanks[i].id] || 0, subHdrStyle())
    }

    numCell(ws, row, fixedCols + bankCount + 1, gPOS, subHdrStyle())
    numCell(ws, row, fixedCols + bankCount + 2, gTransfer, subHdrStyle())
    numCell(ws, row, fixedCols + bankCount + 3, gCash, subHdrStyle())
    numCell(ws, row, fixedCols + bankCount + 4, totals.actual, subHdrStyle())
    numCell(ws, row, fixedCols + bankCount + 5, totals.ovsh, subHdrStyle())
  }
}

// ─── Sheets: Consumption & Pour Back ──────────────────────

function writeConsumption(wb, report, startDate, endDate) {
  const { consumptionReport, fuelTypes } = report
  if (!consumptionReport) return

  for (const ft of fuelTypes) {
    const data = consumptionReport[ft]
    if (!data) continue
    const { customers, rows, totals } = data

    const ws = wb.addWorksheet(`${ft} Consumption`)

    // Columns: Date | Rate | ...customers... | Pour Back
    const colCount = 2 + customers.length + 1
    const colWidths = [{ width: 14 }, { width: 12 }, ...customers.map(() => ({ width: 14 })), { width: 14 }]
    ws.columns = colWidths

    let row = 1

    // Header
    textCell(ws, row, 1, 'Date', hdrStyle())
    textCell(ws, row, 2, 'Rate (N)', hdrStyle())
    for (let i = 0; i < customers.length; i++) {
      textCell(ws, row, 3 + i, customers[i].name, hdrStyle())
    }
    textCell(ws, row, 3 + customers.length, 'Pour Back', hdrStyle())
    row++

    // Data rows
    for (const r of rows) {
      dateCell(ws, row, 1, r.date)
      numCell(ws, row, 2, r.rate)
      for (let i = 0; i < customers.length; i++) {
        numCell(ws, row, 3 + i, r.customerQtys[customers[i].id] || 0)
      }
      numCell(ws, row, 3 + customers.length, r.pourBack || 0)
      row++
    }

    // Totals row
    textCell(ws, row, 1, 'Total', subHdrStyle('left'))
    textCell(ws, row, 2, '', subHdrStyle())
    for (let i = 0; i < customers.length; i++) {
      numCell(ws, row, 3 + i, totals.customerTotals[customers[i].id] || 0, subHdrStyle())
    }
    numCell(ws, row, 3 + customers.length, totals.pourBack || 0, subHdrStyle())
  }
}

// ─── Sheet: Record of Stock Position ──────────────────────

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
    textCell(ws, row, 1, `RECORD OF STOCK POSITION — ${ft}`, hdrStyle())
    ws.mergeCells(row, 1, row, 8)
    row++

    // Header
    const headers = ['Date', 'Opening Stock', 'Product Supplied', 'Qty Sold', 'Closing Stock', 'OV/SH', 'Actual OV/SH', 'VARIANCE']
    for (let i = 0; i < headers.length; i++) {
      textCell(ws, row, i + 1, headers[i], subHdrStyle('center'))
    }
    row++

    // Data rows
    const visibleRows = data.rows.filter(r => r.hasData)
    for (const r of visibleRows) {
      dateCell(ws, row, 1, r.date)
      numCell(ws, row, 2, r.opening)
      numCell(ws, row, 3, r.supply)
      numCell(ws, row, 4, r.qtySold)
      numCell(ws, row, 5, r.closing)
      numCell(ws, row, 6, r.ovsh)
      numCell(ws, row, 7, r.actualOvsh)
      textCell(ws, row, 8, '', cellStyle())
      row++
    }

    // Totals
    if (visibleRows.length > 0) {
      const t = data.totals
      textCell(ws, row, 1, 'Total', subHdrStyle('left'))
      numCell(ws, row, 2, t.opening, subHdrStyle())
      numCell(ws, row, 3, t.supply, subHdrStyle())
      numCell(ws, row, 4, t.qtySold, subHdrStyle())
      numCell(ws, row, 5, t.closing, subHdrStyle())
      numCell(ws, row, 6, t.ovsh, subHdrStyle())
      numCell(ws, row, 7, t.actualOvsh, subHdrStyle())
      textCell(ws, row, 8, '', subHdrStyle())
    }
  }
}

// ─── Sheet: Product Received ──────────────────────────────

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

  ws.columns = [
    { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
  ]

  let row = 1

  // Title
  textCell(ws, row, 1, 'PRODUCT RECEIVED', hdrStyle())
  ws.mergeCells(row, 1, row, 11)
  row++

  // Headers
  const headers = ['Date', '', 'PMS Expected', 'PMS Actual', 'PMS OV/SH',
    'AGO Expected', 'AGO Actual', 'AGO OV/SH',
    'DPK Expected', 'DPK Actual', 'DPK OV/SH']
  for (let i = 0; i < headers.length; i++) {
    textCell(ws, row, i + 1, headers[i], subHdrStyle('center'))
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

    dateCell(ws, row, 1, date)
    dateCell(ws, row, 2, date)
    numCell(ws, row, 3, pmsExp || '')
    numCell(ws, row, 4, pmsAct || '')
    numCell(ws, row, 5, pmsAct - pmsExp || '')
    numCell(ws, row, 6, agoExp || '')
    numCell(ws, row, 7, agoAct || '')
    numCell(ws, row, 8, agoAct - agoExp || '')
    numCell(ws, row, 9, dpkExp || '')
    numCell(ws, row, 10, dpkAct || '')
    numCell(ws, row, 11, dpkAct - dpkExp || '')
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
    textCell(ws, row, 1, 'Total', subHdrStyle('left'))
    textCell(ws, row, 2, '', subHdrStyle())
    numCell(ws, row, 3, tPmsE, subHdrStyle())
    numCell(ws, row, 4, tPmsA, subHdrStyle())
    numCell(ws, row, 5, tPmsA - tPmsE, subHdrStyle())
    numCell(ws, row, 6, tAgoE, subHdrStyle())
    numCell(ws, row, 7, tAgoA, subHdrStyle())
    numCell(ws, row, 8, tAgoA - tAgoE, subHdrStyle())
    numCell(ws, row, 9, tDpkE, subHdrStyle())
    numCell(ws, row, 10, tDpkA, subHdrStyle())
    numCell(ws, row, 11, tDpkA - tDpkE, subHdrStyle())
  }
}

// ─── Sheet: Lubricants ────────────────────────────────────

function writeLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate, fmtDate) {
  const ws = wb.addWorksheet('Lubricants')

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

  // Title
  textCell(ws, row, 1, `LUBRICANTS AS AT ${fmtDate(endDate)} - ${stationName || ''}`, hdrStyle())
  ws.mergeCells(row, 1, row, 10)
  row++

  // Headers
  const headers = ['S/N', 'Size', 'Product', 'Unit', 'Opening', 'Purchase', 'Units Sold', 'Closing', 'Unit Price', 'Value']
  for (let i = 0; i < headers.length; i++) {
    textCell(ws, row, i + 1, headers[i], subHdrStyle('center'))
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

    textCell(ws, row, 1, idx + 1, cellStyle('center'))
    textCell(ws, row, 2, prod.size || '', cellStyle('center'))
    textCell(ws, row, 3, prod.product_name || '', cellStyle('left'))
    textCell(ws, row, 4, prod.unit || 'pcs', cellStyle('center'))
    numCell(ws, row, 5, openingStock)
    numCell(ws, row, 6, purchase)
    numCell(ws, row, 7, unitsSold)
    numCell(ws, row, 8, closingStock)
    numCell(ws, row, 9, unitPrice)
    numCell(ws, row, 10, value)
    row++
  }

  // Totals
  textCell(ws, row, 1, '', subHdrStyle())
  textCell(ws, row, 2, '', subHdrStyle())
  textCell(ws, row, 3, 'TOTAL', subHdrStyle('left'))
  textCell(ws, row, 4, '', subHdrStyle())
  numCell(ws, row, 5, totalOpening, subHdrStyle())
  numCell(ws, row, 6, totalPurchase, subHdrStyle())
  numCell(ws, row, 7, totalSold, subHdrStyle())
  numCell(ws, row, 8, totalClosing, subHdrStyle())
  textCell(ws, row, 9, '', subHdrStyle())
  numCell(ws, row, 10, totalValue, subHdrStyle())
}
