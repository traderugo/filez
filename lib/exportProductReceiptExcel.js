import ExcelJS from 'exceljs'

// ── Styles ───────────────────────────────────────────────────────────────────
const ACCENT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4B084' }, bgColor: { indexed: 64 } }
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } }
const NO_FILL = { type: 'pattern', pattern: 'none' }
const THIN = (argb) => ({ style: 'thin', color: { argb } })
const MED = (argb) => ({ style: 'medium', color: { argb } })
const BORDER = { top: MED('FF000000'), left: MED('FF000000'), bottom: MED('FF000000'), right: MED('FF000000') }

const FONT_MAIN = { name: 'Corbel', family: 2, size: 12, color: { theme: 1 } }
const FONT_MAIN_BOLD = { ...FONT_MAIN, bold: true }
const FONT_MAIN_BLACK = { name: 'Corbel', family: 2, size: 12, color: { argb: 'FF000000' } }
const FONT_SUMMARY = { name: 'Calibri', family: 2, size: 12, color: { argb: 'FF000000' } }
const FONT_SUMMARY_BOLD = { ...FONT_SUMMARY, bold: true }
const FONT_HDR11 = { name: 'Corbel', family: 2, size: 11, bold: true, color: { theme: 1 } }

const ALIGN_CM = { horizontal: 'center', vertical: 'middle' }
const ALIGN_VM = { vertical: 'middle' }
const ALIGN_CENTER = { horizontal: 'center' }
const ALIGN_LM = { horizontal: 'left', vertical: 'middle' }
const ALIGN_RM = { horizontal: 'right', vertical: 'middle' }

function sc(ws, r, c, value, font, fill, alignment) {
  const cell = ws.getCell(r, c)
  cell.value = value ?? null
  cell.font = font || FONT_MAIN
  cell.fill = fill || NO_FILL
  cell.alignment = alignment || ALIGN_CM
  cell.border = BORDER
  return cell
}

function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function fmtTime12(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/**
 * Export a single delivery as an Excel workbook matching the reference template.
 *
 * @param {object} delivery
 * @param {string} delivery.product - Fuel type e.g. "PMS"
 * @param {string} delivery.truckNumber
 * @param {string} delivery.driverName
 * @param {string} delivery.depotName
 * @param {string} delivery.ticketNumber
 * @param {string} delivery.waybillNumber
 * @param {string} delivery.loadedDate - ISO date
 * @param {string} delivery.entryDate - ISO date (date received)
 * @param {string} delivery.arrivalTime - HH:mm
 * @param {string} delivery.exitTime - HH:mm
 * @param {number[]} delivery.chartHighUllage - [comp1, comp2, comp3]
 * @param {number[]} delivery.chartLowUllage - [comp1, comp2, comp3]
 * @param {number[]} delivery.chartLiquidHeight - [comp1, comp2, comp3]
 * @param {number[]} delivery.stationUllage - [comp1, comp2, comp3]
 * @param {number[]} delivery.stationLiquidHeight - [comp1, comp2, comp3]
 * @param {number[]} delivery.depotUllage - [comp1, comp2, comp3] maps to "Waybill"
 * @param {number[]} delivery.depotLiquidHeight - [comp1, comp2, comp3] maps to "Waybill"
 * @param {number[]} delivery.highVol - [comp1, comp2, comp3]
 * @param {number[]} delivery.lowVol - [comp1, comp2, comp3]
 * @param {number} delivery.qtyReceived - total volume received
 */
export async function exportProductReceiptExcel(delivery) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')

  // Column widths
  ws.getColumn(1).width = 6
  ws.getColumn(2).width = 34.71
  ws.getColumn(3).width = 35.57
  ws.getColumn(4).width = 40.71
  ws.getColumn(5).width = 41.14
  ws.getColumn(6).width = 10
  ws.getColumn(7).width = 10
  ws.getColumn(8).width = 10
  ws.getColumn(9).width = 10
  ws.getColumn(10).width = 10

  const d = delivery
  const hv = Array.isArray(d.highVol) ? d.highVol : [0, 0, 0]
  const lv = Array.isArray(d.lowVol) ? d.lowVol : [0, 0, 0]
  const qtyLoaded = (Number(hv[0]) || 0) + (Number(hv[1]) || 0) + (Number(hv[2]) || 0)
  const qtyReceived = Number(d.qtyReceived) || 0
  const shortage = qtyLoaded - qtyReceived
  const overage = shortage < 0 ? Math.abs(shortage) : 0

  // ── Row 1: Accent header (merged A1:E1) ──
  ws.getRow(1).height = 15.75
  for (let c = 1; c <= 5; c++) sc(ws, 1, c, null, FONT_HDR11, ACCENT_FILL, ALIGN_CENTER)
  ws.mergeCells('A1:E1')

  // ── Rows 2-5: Delivery info (A2:A5 merged) ──
  const setInfoRow = (r, h) => { ws.getRow(r).height = h || 16.5 }
  setInfoRow(2); setInfoRow(3); setInfoRow(4); setInfoRow(5)

  // Col A: S/N = 1 (merged A2:A5)
  for (let r = 2; r <= 5; r++) sc(ws, r, 1, 1, FONT_MAIN, NO_FILL, ALIGN_CM)
  ws.mergeCells('A2:A5')

  // Row 2: Product, Truck, Driver
  sc(ws, 2, 2, `PRODUCT: ${d.product || ''}`, FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 2, 3, `TRUCK NO: ${d.truckNumber || ''}`, FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 2, 4, `DRIVER- ${d.driverName || ''}`, FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 2, 5, null, FONT_MAIN, NO_FILL, ALIGN_CM)

  // Row 3: Depot, Ticket, Waybill
  sc(ws, 3, 2, `DEPOT: ${d.depotName || ''}`, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 3, 3, ` TICKET NO: - ${d.ticketNumber || ''}`, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 3, 4, `WAYBILL NO: ${d.waybillNumber || ''}`, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 3, 5, null, FONT_MAIN, NO_FILL, ALIGN_VM)

  // Row 4: Date Loaded, Date Received, Arrival Time
  sc(ws, 4, 2, `DATE LOADED : ${fmtDateShort(d.loadedDate)}`, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 4, 3, `DATE RECEIVED :  ${fmtDateShort(d.entryDate)}`, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 4, 4, `ARRIVALTIME : ${fmtTime12(d.arrivalTime)}`, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 4, 5, null, FONT_MAIN, NO_FILL, ALIGN_VM)

  // Row 5: (empty), Date Received (merged C4:C5), Departure Time
  sc(ws, 5, 2, null, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 5, 3, `DATE RECEIVED :  ${fmtDateShort(d.entryDate)}`, FONT_MAIN, NO_FILL, ALIGN_VM)
  sc(ws, 5, 4, `DEPATURE TIME : ${fmtTime12(d.exitTime)}`, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 5, 5, null, FONT_MAIN, NO_FILL, ALIGN_VM)
  ws.mergeCells('C4:C5')
  ws.mergeCells('E4:E5')

  // ── Row 6: ULLAGE header (merged A6:E6) ──
  ws.getRow(6).height = 16.5
  for (let c = 1; c <= 5; c++) sc(ws, 6, c, 'ULLAGE', FONT_MAIN_BOLD, ACCENT_FILL, ALIGN_CM)
  ws.mergeCells('A6:E6')

  // ── Row 7: Column headers ──
  ws.getRow(7).height = 16.5
  sc(ws, 7, 1, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 7, 2, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 7, 3, 'CHART ULLAGE', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 7, 4, 'STATION ULLAGE', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 7, 5, 'WAYBILL ULLAGE', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)

  // ── Rows 8-10: Ullage data (A8:A10 merged, S/N=2) ──
  const ullageChart = Array.isArray(d.chartHighUllage) ? d.chartHighUllage : [0, 0, 0]
  const ullageStation = Array.isArray(d.stationUllage) ? d.stationUllage : [d.stationUllage, d.stationUllage, d.stationUllage]
  const ullageWaybill = Array.isArray(d.depotUllage) ? d.depotUllage : [d.depotUllage, d.depotUllage, d.depotUllage]
  const compartLabels = ['COMPARTMENT 1 ', 'COMPARTMENT 2', 'COMPARTMENT 3']

  for (let i = 0; i < 3; i++) {
    const r = 8 + i
    ws.getRow(r).height = 16.5
    sc(ws, r, 1, 2, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 2, compartLabels[i], FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 3, Number(ullageChart[i]) || 0, FONT_MAIN_BLACK, NO_FILL, ALIGN_CENTER)
    sc(ws, r, 4, Number(ullageStation[i]) || 0, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 5, Number(ullageWaybill[i]) || 0, FONT_MAIN, NO_FILL, ALIGN_CM)
  }
  ws.mergeCells('A8:A10')

  // ── Row 11: LIQUID HEIGHT header (merged A11:E11) ──
  ws.getRow(11).height = 16.5
  for (let c = 1; c <= 5; c++) sc(ws, 11, c, 'LIQUID HEIGHT', FONT_MAIN_BOLD, ACCENT_FILL, ALIGN_CM)
  ws.mergeCells('A11:E11')

  // ── Row 12: Column headers ──
  ws.getRow(12).height = 16.5
  sc(ws, 12, 1, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 12, 2, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 12, 3, 'CHART LIQUID HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 12, 4, 'STATION LIQUID HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 12, 5, 'WAYBILL LIQUID HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)

  // ── Rows 13-15: Liquid Height data (A13:A15 merged, S/N=3) ──
  const lhChart = Array.isArray(d.chartLiquidHeight) ? d.chartLiquidHeight : [d.chartLiquidHeight, d.chartLiquidHeight, d.chartLiquidHeight]
  const lhStation = Array.isArray(d.stationLiquidHeight) ? d.stationLiquidHeight : [d.stationLiquidHeight, d.stationLiquidHeight, d.stationLiquidHeight]
  const lhWaybill = Array.isArray(d.depotLiquidHeight) ? d.depotLiquidHeight : [d.depotLiquidHeight, d.depotLiquidHeight, d.depotLiquidHeight]
  const compartLabels2 = ['COMPARTMENT1 ', 'COMPARTMENT 2', 'COMPARTMENT 3']

  for (let i = 0; i < 3; i++) {
    const r = 13 + i
    ws.getRow(r).height = 16.5
    sc(ws, r, 1, 3, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 2, compartLabels2[i], FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 3, Number(lhChart[i]) || 0, FONT_MAIN_BLACK, NO_FILL, ALIGN_CENTER)
    sc(ws, r, 4, Number(lhStation[i]) || 0, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 5, Number(lhWaybill[i]) || 0, FONT_MAIN, NO_FILL, ALIGN_CM)
  }
  ws.mergeCells('A13:A15')

  // ── Row 16: OVERALL HEIGHT header (merged A16:E16) ──
  ws.getRow(16).height = 16.5
  for (let c = 1; c <= 5; c++) sc(ws, 16, c, 'OVERALL HEIGHT', FONT_MAIN_BOLD, ACCENT_FILL, ALIGN_CM)
  ws.mergeCells('A16:E16')

  // ── Row 17: Column headers ──
  ws.getRow(17).height = 16.5
  sc(ws, 17, 1, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 17, 2, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 17, 3, 'CHART OVERALL HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 17, 4, 'STATION/PHYSICAL OVERALL HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 17, 5, 'WAYBILL OVERALL HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)

  // ── Rows 18-20: Overall Height — NIL (A18:A20 merged, S/N=4) ──
  for (let i = 0; i < 3; i++) {
    const r = 18 + i
    ws.getRow(r).height = 16.5
    sc(ws, r, 1, 4, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 2, `COMPARTMENT ${i + 1}`, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 3, 'NIL', FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 4, 'NIL', FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 5, 'NIL', FONT_MAIN, NO_FILL, ALIGN_CM)
  }
  ws.mergeCells('A18:A20')

  // ── Row 21: NECK HEIGHT header (merged A21:E21) ──
  ws.getRow(21).height = 16.5
  for (let c = 1; c <= 5; c++) sc(ws, 21, c, 'NECK HEIGHT', FONT_MAIN_BOLD, ACCENT_FILL, ALIGN_CM)
  ws.mergeCells('A21:E21')

  // ── Row 22: Column headers ──
  ws.getRow(22).height = 16.5
  sc(ws, 22, 1, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 22, 2, null, FONT_MAIN, NO_FILL, ALIGN_CM)
  sc(ws, 22, 3, 'CHART NECK HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 22, 4, 'STATION/PHYSICAL NECK HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 22, 5, 'WAYBILL NECK HEIGHT', FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)

  // ── Rows 23-25: Neck Height — NIL (A23:A25 merged, S/N=5) ──
  for (let i = 0; i < 3; i++) {
    const r = 23 + i
    ws.getRow(r).height = 16.5
    sc(ws, r, 1, 5, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 2, `COMPARTMENT ${i + 1}`, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 3, 'NIL', FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 4, 'NIL', FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 5, 'NIL', FONT_MAIN, NO_FILL, ALIGN_CM)
  }
  ws.mergeCells('A23:A25')

  // ── Row 26: Blank bordered row ──
  ws.getRow(26).height = 16.5
  for (let c = 1; c <= 5; c++) sc(ws, 26, c, null, FONT_MAIN, NO_FILL, ALIGN_CM)

  // ── Row 27: Quantity summary (S/N=6) ──
  ws.getRow(27).height = 16.5
  sc(ws, 27, 1, 6, FONT_MAIN_BOLD, NO_FILL, ALIGN_CM)
  sc(ws, 27, 2, `QUANTITY LOADED: ${qtyLoaded}L`, FONT_MAIN_BOLD, NO_FILL, ALIGN_VM)
  sc(ws, 27, 3, `QUANTITY RECEIVED:${qtyReceived}L`, FONT_MAIN_BOLD, NO_FILL, ALIGN_VM)
  sc(ws, 27, 4, ` SHORTAGE: ${shortage > 0 ? shortage : 0}`, FONT_MAIN_BOLD, NO_FILL, ALIGN_VM)
  sc(ws, 27, 5, `OVERAGE: ${overage > 0 ? overage : 'NILL'}`, FONT_MAIN_BOLD, NO_FILL, ALIGN_VM)

  // ── Rows 28-29: Empty ──

  // ── Row 30: "PRODUCT RECEIPT SUMMARY" label ──
  ws.getCell(30, 2).value = 'PRODUCT RECEIPT SUMMARY '

  // ── Compute MF per compartment ──
  const chartHighU = Array.isArray(d.chartHighUllage) ? d.chartHighUllage : [0, 0, 0]
  const chartLowU = Array.isArray(d.chartLowUllage) ? d.chartLowUllage : [0, 0, 0]
  const stU = Array.isArray(d.stationUllage) ? d.stationUllage : [0, 0, 0]
  const dpU = Array.isArray(d.depotUllage) ? d.depotUllage : [0, 0, 0]
  const cLH = Array.isArray(d.chartLiquidHeight) ? d.chartLiquidHeight : [0, 0, 0]
  const sLH = Array.isArray(d.stationLiquidHeight) ? d.stationLiquidHeight : [0, 0, 0]

  const ullageMF = []
  const lhMF = []
  for (let i = 0; i < 3; i++) {
    const hV = Number(hv[i]) || 0
    const lV = Number(lv[i]) || 0
    const hU = Number(chartHighU[i]) || 0
    const lU = Number(chartLowU[i]) || 0
    const cL = Number(cLH[i]) || 0
    const denom = hU - lU
    ullageMF.push(denom !== 0 ? (hV - lV) / denom : 0)
    lhMF.push(cL !== 0 ? hV / cL : 0)
  }

  // ── Helper for summary comparison tables ──
  const FONT_SEG = { name: 'Segoe UI', family: 2, size: 11, color: { argb: 'FF242424' } }
  const summaryBlankRow = (r) => {
    ws.getRow(r).height = 16.5
    for (let c = 2; c <= 7; c++) {
      const cell = ws.getCell(r, c)
      cell.font = FONT_SEG; cell.fill = NO_FILL; cell.alignment = { horizontal: 'left' }; cell.border = BORDER
    }
  }

  const buildComparisonTable = (startRow, sn, title, col1Label, col2Label, col1Vals, col2Vals, mfVals) => {
    // Header row (merged C:G)
    ws.getRow(startRow).height = 15.75
    sc(ws, startRow, 2, sn, FONT_SUMMARY_BOLD, NO_FILL, ALIGN_RM)
    for (let c = 3; c <= 7; c++) sc(ws, startRow, c, title, FONT_SUMMARY_BOLD, NO_FILL, ALIGN_CM)
    ws.mergeCells(`C${startRow}:G${startRow}`)

    // Column headers
    const hr = startRow + 1
    ws.getRow(hr).height = 15.75
    sc(ws, hr, 2, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, hr, 3, col1Label, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, hr, 4, col2Label, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, hr, 5, 'Diff', FONT_SUMMARY, mfVals ? YELLOW_FILL : NO_FILL, ALIGN_LM)
    sc(ws, hr, 6, mfVals ? 'MF' : null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, hr, 7, 'Diff', FONT_SUMMARY, mfVals ? YELLOW_FILL : NO_FILL, ALIGN_LM)

    // Data rows (3 compartments)
    for (let i = 0; i < 3; i++) {
      const dr = startRow + 2 + i
      ws.getRow(dr).height = 16.5
      sc(ws, dr, 2, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
      sc(ws, dr, 3, Number(col1Vals[i]) || 0, FONT_MAIN_BLACK, NO_FILL, ALIGN_CENTER)
      sc(ws, dr, 4, Number(col2Vals[i]) || 0, FONT_MAIN, NO_FILL, ALIGN_CM)
      sc(ws, dr, 5, { formula: `C${dr}-D${dr}` }, FONT_SUMMARY, mfVals ? YELLOW_FILL : NO_FILL, ALIGN_RM)
      const mfCell = sc(ws, dr, 6, mfVals ? (Number(mfVals[i]) || 0) : 0, FONT_SUMMARY, NO_FILL, ALIGN_RM)
      if (mfVals) mfCell.numFmt = '0.00'
      sc(ws, dr, 7, { formula: `E${dr}*F${dr}` }, FONT_SUMMARY, mfVals ? YELLOW_FILL : NO_FILL, ALIGN_RM)
    }

    // Totals row
    const tr = startRow + 5
    ws.getRow(tr).height = 15.75
    sc(ws, tr, 2, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, tr, 3, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, tr, 4, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    const d1 = startRow + 2, d3 = startRow + 4
    sc(ws, tr, 5, { formula: `SUM(E${d1},E${d1 + 1},E${d3})` }, FONT_SUMMARY, NO_FILL, ALIGN_RM)
    sc(ws, tr, 6, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
    sc(ws, tr, 7, { formula: `SUM(G${d1},G${d1 + 1},G${d3})` }, FONT_SUMMARY_BOLD, NO_FILL, ALIGN_RM)

    // Blank separator rows
    summaryBlankRow(startRow + 6)
    summaryBlankRow(startRow + 7)
  }

  // 1) Chart vs Loading — rows 32-39
  buildComparisonTable(32, 1, 'Chart vs Loading', 'Chart ', 'Loading', chartHighU, dpU, ullageMF)
  // 2) Chart vs Station — rows 40-47
  buildComparisonTable(40, 2, 'Chart vs Station', 'Chart', 'Station', chartHighU, stU, ullageMF)
  // 3) Loading vs Station — rows 48-53 (no MF)
  buildComparisonTable(48, 3, 'Loading vs Station', 'Loading', 'Station', dpU, stU, null)

  // ── Liquid Height summary (rows 55-63) ──
  ws.getRow(55).height = 15.75
  ws.getCell(55, 2).value = 'Liquid height '
  ws.getCell(55, 2).font = { ...FONT_SUMMARY, size: 12 }
  ws.getCell(55, 2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  ws.getCell(55, 2).border = BORDER

  // Empty rows 56-58
  for (let r = 56; r <= 58; r++) {
    const cell = ws.getCell(r, 2)
    cell.value = r === 56 ? null : ''
    cell.border = BORDER
  }

  // Row 59: Headers
  ws.getRow(59).height = 15.75
  const lhHeaders = ['S/N', 'TRUCK DETAILS', 'CAPACITY', 'CHAT LH', 'STATION LH', 'DIFF', 'M*F', 'DIFF']
  for (let i = 0; i < lhHeaders.length; i++) {
    sc(ws, 59, i + 2, lhHeaders[i], FONT_SUMMARY_BOLD, NO_FILL, ALIGN_CM)
  }
  sc(ws, 59, 10, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)

  // Rows 60-62: Data (3 compartments, B60:B62 and C60:C62 merged)
  for (let i = 0; i < 3; i++) {
    const r = 60 + i
    ws.getRow(r).height = 16.5
    sc(ws, r, 2, 1, FONT_SUMMARY_BOLD, NO_FILL, ALIGN_CM)
    sc(ws, r, 3, d.truckNumber || '', FONT_SUMMARY_BOLD, NO_FILL, ALIGN_CM)
    sc(ws, r, 4, null, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 5, Number(cLH[i]) || 0, FONT_MAIN_BLACK, NO_FILL, ALIGN_CENTER)
    sc(ws, r, 6, Number(sLH[i]) || 0, FONT_MAIN, NO_FILL, ALIGN_CM)
    sc(ws, r, 7, { formula: `E${r}-F${r}` }, FONT_SUMMARY, YELLOW_FILL, ALIGN_CM)
    const mfLhCell = sc(ws, r, 8, Number(lhMF[i]) || 0, FONT_SUMMARY, NO_FILL, ALIGN_CM)
    mfLhCell.numFmt = '0.00'
    sc(ws, r, 9, { formula: `H${r}*G${r}` }, FONT_SUMMARY, YELLOW_FILL, ALIGN_CM)
    sc(ws, r, 10, null, FONT_SUMMARY, NO_FILL, ALIGN_LM)
  }
  ws.mergeCells('B60:B62')
  ws.mergeCells('C60:C62')
  ws.mergeCells('J59:J61')

  // Row 63: Totals
  ws.getRow(63).height = 15.75
  ws.getCell(63, 6).font = FONT_MAIN
  ws.getCell(63, 6).alignment = ALIGN_CM
  ws.getCell(63, 6).border = BORDER
  ws.getCell(63, 9).value = { formula: 'SUM(I60,I61,I62)' }

  // Rows 66-68: S/N reference at bottom
  ws.getCell(66, 1).value = 1
  ws.getCell(67, 1).value = 2
  ws.getCell(68, 1).value = 3
  ws.getCell(68, 4).value = ' '

  // Generate buffer and trigger download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Product Receipt - ${d.truckNumber || 'Unknown'} - ${d.entryDate || 'Unknown'}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
