import * as XLSX from 'xlsx'

/**
 * Export audit report data to Excel using the template.
 * Runs entirely client-side — fetches template, fills data cells, triggers download.
 * Formula cells are preserved and auto-calculate from the data we fill in.
 */
// Section configs for regular vs extended template (all 0-indexed rows)
const REGULAR_SECTIONS = {
  PMS: { meterHeader: 7, pumpStart: 9, pumpEnd: 85, pourBackStart: 89, pourBackEnd: 93, consumeStart: 97, consumeEnd: 108 },
  AGO: { meterHeader: 116, pumpStart: 118, pumpEnd: 145, pourBackStart: 149, pourBackEnd: 154, consumeStart: 158, consumeEnd: 174 },
  DPK: { meterHeader: 182, pumpStart: 184, pumpEnd: 206, pourBackStart: 210, pourBackEnd: 215, consumeStart: 219, consumeEnd: 221 },
}
const EXTENDED_SECTIONS = {
  PMS: { meterHeader: 7, pumpStart: 9, pumpEnd: 162, pourBackStart: 166, pourBackEnd: 170, consumeStart: 174, consumeEnd: 185 },
  AGO: { meterHeader: 193, pumpStart: 195, pumpEnd: 250, pourBackStart: 254, pourBackEnd: 259, consumeStart: 263, consumeEnd: 279 },
  DPK: { meterHeader: 287, pumpStart: 289, pumpEnd: 334, pourBackStart: 338, pourBackEnd: 343, consumeStart: 347, consumeEnd: 349 },
}

/** Check if any fuel type needs more pump rows than the regular template */
function needsExtended(report, nozzles) {
  if (!report?.salesCash) return false
  for (const ft of report.fuelTypes || []) {
    const summary = report.salesCash.fuelSummaries[ft]
    if (!summary) continue
    const pumpCount = nozzles.filter(n => n.fuel_type === ft).length
    const blockSize = pumpCount + 2
    const rowsNeeded = summary.rows.length * blockSize
    const sec = REGULAR_SECTIONS[ft]
    if (sec && rowsNeeded > sec.pumpEnd - sec.pumpStart + 1) return true
  }
  return false
}

export async function exportAuditExcel({
  report,
  receipts,
  lubeSales,
  lubeStock,
  lubeProducts,
  tanks,
  nozzles,
  stationName,
  startDate,
  endDate,
}) {
  let useExtended = needsExtended(report, nozzles)

  // Try extended template first; fall back to regular if it fails to load
  let buf
  if (useExtended) {
    try {
      const resp = await fetch('/templates/AUDIT REPORT TEMPLATE (EXTENDED).xlsx')
      if (resp.ok) buf = await resp.arrayBuffer()
    } catch { /* fall through to regular */ }
  }
  if (!buf) {
    useExtended = false
    const resp = await fetch('/templates/AUDIT REPORT TEMPLATE.xlsx')
    if (!resp.ok) throw new Error('Failed to load Excel template')
    buf = await resp.arrayBuffer()
  }
  const sections = useExtended ? EXTENDED_SECTIONS : REGULAR_SECTIONS
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellStyles: true })

  const fmtDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const warnings = []
  fillSalesCash(wb, report, nozzles, stationName, startDate, endDate, fmtDate, sections, warnings)
  fillStockSummary(wb, report, stationName, startDate, endDate, fmtDate)
  fillLodgement(wb, report, startDate, endDate, stationName)
  fillConsumptionSheets(wb, report)
  fillProductReceived(wb, receipts, tanks, startDate, endDate)
  fillRecordOfStock(wb, report)
  fillLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate, fmtDate)

  XLSX.writeFile(wb, `Audit Report ${startDate} to ${endDate}.xlsx`)

  return { warnings }
}

// ─── Helpers ───────────────────────────────────────────────

/** Set a cell value, preserving formula cells and existing formatting */
function set(ws, addr, value) {
  if (value == null || value === '') return
  if (ws[addr]?.f) return
  const t = typeof value === 'number' ? 'n' : 's'
  if (ws[addr]) {
    ws[addr].v = value
    ws[addr].t = t
  } else {
    ws[addr] = { v: value, t }
  }
}

/** Set a cell by 0-indexed row and column */
function setAt(ws, r, c, value) {
  set(ws, XLSX.utils.encode_cell({ r, c }), value)
}

/** Clear all non-formula cells in a range */
function clearRange(ws, startRow, endRow, cols) {
  for (let r = startRow; r <= endRow; r++) {
    for (const c of cols) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (ws[addr] && !ws[addr].f) delete ws[addr]
    }
  }
}

/** Convert YYYY-MM-DD to Excel serial date number */
function dateToExcel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const epoch = new Date('1899-12-30T00:00:00')
  return Math.floor((d - epoch) / 86400000)
}

// 0-indexed column constants
const B = 1, C = 2, D = 3, E = 4, F = 5, G = 6, H = 7
const I = 8, J = 9, K = 10, L = 11, M = 12, N = 13, O = 14, P = 15
const Q = 16, R = 17, S = 18, T = 19, U = 20, V = 21

// ─── Sheet 2: Sales/Cash Position ──────────────────────────
//
// Layout per fuel type:
//   Pump meter blocks: each block = pumpCount rows + 2 spacer rows
//   Data cells per pump row: B(label), C(opening), D(closing), F(price)
//   E(dispensed) = formula D-C, G(amount) = formula E*F
//   Pour back detail rows: C(name), E(qty), F(price), G(amount)
//   Consumption detail rows: same layout
//   Summary rows (A, B, C=A-B, D, E=C-D) are all formulas

function fillSalesCash(wb, report, nozzles, stationName, startDate, endDate, fmtDate, sections, warnings) {
  const ws = wb.Sheets['2. Sales>>Cash Position']
  if (!ws || !report?.salesCash) return

  const { salesCash, fuelTypes } = report

  // Update headers
  set(ws, 'C3', stationName || '')
  set(ws, 'D3', `CASH/SALES RECONCILIATION AS AT ${fmtDate(startDate)} - ${fmtDate(endDate)}`)

  for (const ft of fuelTypes) {
    const sec = sections[ft]
    if (!sec) continue
    const summary = salesCash.fuelSummaries[ft]
    if (!summary) continue

    const pumpCount = nozzles.filter(n => n.fuel_type === ft).length

    // Update meter column headers with actual dates
    setAt(ws, sec.meterHeader, C, `Opening (${fmtDate(startDate)})`)
    setAt(ws, sec.meterHeader, D, `Closing (${fmtDate(endDate)})`)

    // Clear existing pump data (B=label, C=opening, D=closing, F=price)
    clearRange(ws, sec.pumpStart, sec.pumpEnd, [B, C, D, F])

    // Fill pump meter blocks — one block per price period
    const blockSize = pumpCount + 2
    const maxBlocks = Math.floor((sec.pumpEnd - sec.pumpStart + 1) / blockSize)
    if (summary.rows.length > maxBlocks) {
      warnings.push(`${ft}: ${summary.rows.length} price periods but only ${maxBlocks} fit in template. Some data truncated.`)
    }
    for (let bi = 0; bi < summary.rows.length; bi++) {
      const blockStart = sec.pumpStart + bi * blockSize
      if (blockStart + pumpCount - 1 > sec.pumpEnd) break

      const period = summary.rows[bi]
      for (let p = 0; p < period.pumps.length; p++) {
        const r = blockStart + p
        const pump = period.pumps[p]
        setAt(ws, r, B, pump.label)
        setAt(ws, r, C, pump.opening)
        setAt(ws, r, D, pump.closing)
        setAt(ws, r, F, period.price)
      }
    }

    // Fill pour back detail rows
    clearRange(ws, sec.pourBackStart, sec.pourBackEnd, [C, E, F, G])
    const pourBackGroups = summary.consumption?.pourBackByPrice || []
    for (let i = 0; i < pourBackGroups.length && sec.pourBackStart + i <= sec.pourBackEnd; i++) {
      const r = sec.pourBackStart + i
      const g = pourBackGroups[i]
      const names = g.entries.map(e => e.name).filter((v, idx, a) => a.indexOf(v) === idx).join(', ')
      setAt(ws, r, C, names)
      setAt(ws, r, E, g.totalQty)
      setAt(ws, r, F, g.price)
      setAt(ws, r, G, g.totalAmt)
    }

    // Fill consumption detail rows
    clearRange(ws, sec.consumeStart, sec.consumeEnd, [C, E, F, G])
    const consumeGroups = summary.consumption?.consumedByPrice || []
    let cr = sec.consumeStart
    for (const g of consumeGroups) {
      // Dedupe entries by name within this price group
      const byName = {}
      for (const e of g.entries) {
        if (!byName[e.name]) byName[e.name] = { qty: 0, amt: 0 }
        byName[e.name].qty += e.qty
        byName[e.name].amt += e.amt
      }
      for (const [name, data] of Object.entries(byName)) {
        if (cr > sec.consumeEnd) break
        setAt(ws, cr, C, name)
        setAt(ws, cr, E, data.qty)
        setAt(ws, cr, F, g.price)
        setAt(ws, cr, G, data.amt)
        cr++
      }
    }
  }
}

// ─── Sheet 3: Stock Position (Summary) ─────────────────────
//
// Per fuel type: fixed rows with data + formula cells
// Data cells: opening, supply, closing, dispensed, expected litres, actual litres
// Formula cells: available (opening+supply), qty sold, OV/SH, truck driver OV/SH

function fillStockSummary(wb, report, stationName, startDate, endDate, fmtDate) {
  const ws = wb.Sheets['3.Stock Position']
  if (!ws || !report?.stockPosition) return

  set(ws, 'C2', `AUDIT REPORT FOR : ${stationName || ''}`)
  set(ws, 'C3', `STOCK POSITION FOR THE PERIOD (${fmtDate(startDate)}- ${fmtDate(endDate)})`)

  // Each fuel section has the same relative layout from its header row.
  // Offsets from header: +1=opening, +3=supply, +5=available(formula),
  // +7=closing, +9=qtySold(formula), +11=dispensed, +13=OV/SH(formula),
  // +17=expectedLitres, +19=actualLitres, +21=truckDriverOvsh(formula)
  const fuelHeaders = { PMS: 5, AGO: 31, DPK: 58 } // 0-indexed

  const { stockPosition, fuelTypes } = report

  for (const ft of fuelTypes) {
    const h = fuelHeaders[ft]
    if (h == null) continue
    const data = stockPosition[ft]
    if (!data) continue
    const t = data.totals

    // Update date labels
    setAt(ws, h + 1, C, `OPENING STOCK (${fmtDate(startDate)})`)
    setAt(ws, h + 7, C, `CLOSING STOCK (${fmtDate(endDate)})`)

    // Data cells only — formulas at +5, +9, +13, +21 are preserved
    setAt(ws, h + 1, D, t.opening)
    setAt(ws, h + 3, D, t.supply)
    setAt(ws, h + 7, D, t.closing)
    setAt(ws, h + 11, D, t.dispensed)
    setAt(ws, h + 17, D, t.expectedLitres)
    setAt(ws, h + 19, D, t.actualLitresReceived)
  }
}

// ─── Sheet 4: Lodgement Sheet ──────────────────────────────
//
// Each date uses 3 rows:
//   Row 1: B=date, E=cashSales, I-P=POSBankAmounts (C,Q,S are formulas)
//   Row 2: T=actualDeposit, V=depositDate
//   Row 3: empty
// Bank name headers at row 9 (0-indexed row 8), columns I-P

function fillLodgement(wb, report, startDate, endDate, stationName) {
  const ws = wb.Sheets['4.Lodgement Sheet']
  if (!ws || !report?.lodgementSheet) return

  const { rows, banks } = report.lodgementSheet

  set(ws, 'C2', stationName || '')

  // Map POS banks to columns I-P (up to 8)
  const posBanks = banks.filter(b => b.lodgement_type === 'pos').slice(0, 8)

  // Write bank headers
  clearRange(ws, 8, 8, [I, J, K, L, M, N, O, P])
  for (let i = 0; i < posBanks.length; i++) {
    setAt(ws, 8, I + i, posBanks[i].bank_name)
  }

  // Clear data rows (0-indexed 10-170 = rows 11-171)
  clearRange(ws, 10, 170, [B, E, G, I, J, K, L, M, N, O, P, R, T, U, V])

  // Fill — 3 rows per date
  const visibleRows = rows.filter(r => r.hasData)
  for (let i = 0; i < visibleRows.length && i < 54; i++) {
    const row = visibleRows[i]
    const r1 = 10 + i * 3
    const r2 = r1 + 1

    // Row 1: date + cash sales + POS amounts
    setAt(ws, r1, B, dateToExcel(row.date))
    setAt(ws, r1, E, row.totalSales - row.totalPOS) // cash sales
    for (let j = 0; j < posBanks.length; j++) {
      setAt(ws, r1, I + j, row.bankAmounts[posBanks[j].id] || 0)
    }

    // Row 2: actual deposit
    setAt(ws, r2, T, row.actual)
    setAt(ws, r2, V, dateToExcel(row.date))
  }
}

// ─── Sheets 5/6/7: Consumption & Pour Back ─────────────────
//
// Per fuel type: Date, Rate, customer quantity columns, Pour back column.
// Headers and data start rows differ slightly per sheet.
// We overwrite customer headers with actual names and fill data rows.

function fillConsumptionSheets(wb, report) {
  if (!report?.consumptionReport) return

  const configs = {
    PMS: { sheet: '5.PMS Consumption and Pour back', headerRow: 4, dataStart: 5, totalsRow: 35, maxCust: 9 },
    AGO: { sheet: '6.AGO Consumption and Pour back', headerRow: 4, dataStart: 5, totalsRow: 37, maxCust: 5 },
    DPK: { sheet: '7.DPK Consumption and Pour back', headerRow: 5, dataStart: 6, totalsRow: 36, maxCust: 5 },
  }

  for (const [ft, cfg] of Object.entries(configs)) {
    const ws = wb.Sheets[cfg.sheet]
    if (!ws) continue
    const data = report.consumptionReport[ft]
    if (!data) continue

    const { customers, rows, totals } = data
    const custSlice = customers.slice(0, cfg.maxCust)
    const pourBackCol = D + custSlice.length

    // Clear header row customer columns
    for (let c = D; c <= D + cfg.maxCust + 1; c++) {
      const addr = XLSX.utils.encode_cell({ r: cfg.headerRow, c })
      if (ws[addr] && !ws[addr].f) delete ws[addr]
    }

    // Write customer headers + pour back
    for (let i = 0; i < custSlice.length; i++) {
      setAt(ws, cfg.headerRow, D + i, custSlice[i].name)
    }
    setAt(ws, cfg.headerRow, pourBackCol, 'Pour back')

    // Clear data + totals area
    const clearCols = []
    for (let c = B; c <= D + cfg.maxCust + 1; c++) clearCols.push(c)
    clearRange(ws, cfg.dataStart, cfg.totalsRow, clearCols)

    // Fill data rows (only days with data)
    const visibleRows = rows.filter(r => r.hasData)
    for (let i = 0; i < visibleRows.length; i++) {
      const r = cfg.dataStart + i
      if (r >= cfg.totalsRow) break
      const row = visibleRows[i]
      setAt(ws, r, B, dateToExcel(row.date))
      setAt(ws, r, C, row.rate)
      for (let j = 0; j < custSlice.length; j++) {
        setAt(ws, r, D + j, row.customerQtys[custSlice[j].id] || 0)
      }
      setAt(ws, r, pourBackCol, row.pourBack || 0)
    }

    // Fill totals row at fixed position
    setAt(ws, cfg.totalsRow, B, 'Total')
    for (let j = 0; j < custSlice.length; j++) {
      setAt(ws, cfg.totalsRow, D + j, totals.customerTotals[custSlice[j].id] || 0)
    }
    setAt(ws, cfg.totalsRow, pourBackCol, totals.pourBack || 0)
  }
}

// ─── Sheet 8: Product Received ─────────────────────────────
//
// Columns: B=loadingDate, C=receiptDate
//   PMS: D=expected, F=actual
//   AGO: I=expected, K=actual
//   DPK: N=expected, P=actual
// Data rows: 0-indexed 8-50 (rows 9-51). Totals at row 51 (0-indexed).

function fillProductReceived(wb, receipts, tanks, startDate, endDate) {
  const ws = wb.Sheets['8.Product Received']
  if (!ws) return

  const tankFuel = {}
  for (const t of (tanks || [])) tankFuel[t.id] = t.fuel_type

  const rangeReceipts = (receipts || [])
    .filter(r => (r.entryDate || '') >= startDate && (r.entryDate || '') <= endDate)
    .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  // Group by date
  const byDate = {}
  for (const r of rangeReceipts) {
    if (!byDate[r.entryDate]) byDate[r.entryDate] = []
    byDate[r.entryDate].push(r)
  }

  // Clear data area
  clearRange(ws, 8, 50, [B, C, D, F, I, K, N, P])

  const dates = Object.keys(byDate).sort()
  for (let i = 0; i < dates.length && i < 43; i++) {
    const r = 8 + i
    const date = dates[i]
    const entries = byDate[date]

    setAt(ws, r, B, dateToExcel(date))
    setAt(ws, r, C, dateToExcel(date))

    let pmsExp = 0, pmsAct = 0, agoExp = 0, agoAct = 0, dpkExp = 0, dpkAct = 0
    for (const e of entries) {
      const ft = tankFuel[e.tankId]
      const expected = Number(e.firstCompartment || 0) + Number(e.secondCompartment || 0) + Number(e.thirdCompartment || 0)
      const actual = Number(e.actualVolume || 0)
      if (ft === 'PMS') { pmsExp += expected; pmsAct += actual }
      else if (ft === 'AGO') { agoExp += expected; agoAct += actual }
      else if (ft === 'DPK') { dpkExp += expected; dpkAct += actual }
    }

    if (pmsExp) setAt(ws, r, D, pmsExp)
    if (pmsAct) setAt(ws, r, F, pmsAct)
    if (agoExp) setAt(ws, r, I, agoExp)
    if (agoAct) setAt(ws, r, K, agoAct)
    if (dpkExp) setAt(ws, r, N, dpkExp)
    if (dpkAct) setAt(ws, r, P, dpkAct)
  }
}

// ─── Sheet 10: Record of Stock Position ────────────────────
//
// Three fuel sections side by side:
//   PMS: B(date), C(opening), D(supply), E(qtySold), F(closing)
//   AGO: H(date), I(opening), J(supply), K(qtySold), L(closing)
//   DPK: N(date), O(opening), P(supply), Q(qtySold), R(closing)
// Data rows: 0-indexed 7-36 (rows 8-37). Row 37 (0-indexed) = row 38 = end row.

function fillRecordOfStock(wb, report) {
  const ws = wb.Sheets['10.Record of Stock Position']
  if (!ws || !report?.stockPosition) return

  const { stockPosition, fuelTypes } = report

  const fuelCols = {
    PMS: { date: B, opening: C, supply: D, qtySold: E, closing: F },
    AGO: { date: H, opening: I, supply: J, qtySold: K, closing: L },
    DPK: { date: N, opening: O, supply: P, qtySold: Q, closing: R },
  }

  // Clear all data including end row
  for (const cols of Object.values(fuelCols)) {
    clearRange(ws, 7, 37, Object.values(cols))
  }

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const cols = fuelCols[ft]
    if (!cols) continue

    const visibleRows = data.rows.filter(r => r.hasData)
    for (let i = 0; i < visibleRows.length && i < 30; i++) {
      const r = 7 + i
      const row = visibleRows[i]
      setAt(ws, r, cols.date, dateToExcel(row.date))
      setAt(ws, r, cols.opening, row.opening)
      if (row.supply) setAt(ws, r, cols.supply, row.supply)
      setAt(ws, r, cols.qtySold, row.qtySold)
      setAt(ws, r, cols.closing, row.closing)
    }
  }
}

// ─── Castro Lubricants ─────────────────────────────────────
//
// Columns: B(S/N), C(ITEM), D(Litre), E(OPENING STOCK), F(PURCHASE),
//   G(SALES - formula E+F-H), H(CLOSING STOCK), I(PRICE),
//   J(AMOUNT - formula G*I)
// Data rows: 0-indexed 4-28 (rows 5-29). Row 29 (0-indexed) = totals with formulas.

function fillLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate, fmtDate) {
  const ws = wb.Sheets['Castro Lubricants']
  if (!ws || !lubeProducts?.length) return

  // Update title
  set(ws, 'B3', `LUBRICANTS AS AT ${fmtDate(endDate)} - ${stationName || ''}`)

  // Clear data rows (don't touch G and J which are formulas)
  clearRange(ws, 4, 28, [B, C, D, E, F, H, I])

  const products = [...lubeProducts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const stockSorted = [...(lubeStock || [])].sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  for (let i = 0; i < products.length && i < 25; i++) {
    const r = 4 + i
    const prod = products[i]

    // Sales in the period
    const prodSales = (lubeSales || []).filter(s =>
      s.productId === prod.id && s.entryDate >= startDate && s.entryDate <= endDate
    )

    // Stock entries for this product
    const prodStock = stockSorted.filter(s => s.productId === prod.id)

    // Opening stock: last stock entry at or before startDate
    let openingStock = 0
    for (const s of prodStock) {
      if (s.entryDate <= startDate) openingStock = Number(s.stock || 0)
    }

    // Closing stock: last stock entry at or before endDate
    let closingStock = openingStock
    for (const s of prodStock) {
      if (s.entryDate <= endDate) closingStock = Number(s.stock || 0)
    }

    // Purchase = sum of unitReceived in period
    const purchase = prodSales.reduce((sum, s) => sum + Number(s.unitReceived || 0), 0)

    setAt(ws, r, B, i + 1)
    setAt(ws, r, C, prod.product_name)
    setAt(ws, r, E, openingStock)
    if (purchase) setAt(ws, r, F, purchase)
    setAt(ws, r, H, closingStock)
    setAt(ws, r, I, Number(prod.unit_price || 0))
    // G (sales qty) and J (amount) are formulas — auto-calculated
  }
}
