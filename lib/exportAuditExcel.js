import ExcelJS from 'exceljs'

/**
 * Export audit report data to Excel using the template.
 * Runs entirely client-side — fetches template, fills data cells, triggers download.
 * Formula cells are preserved and auto-calculate from the data we fill in.
 */

// Section configs (1-indexed rows for ExcelJS)
const REGULAR_SECTIONS = {
  PMS: { meterHeader: 8, pumpStart: 10, pumpEnd: 86, pourBackStart: 90, pourBackEnd: 94, consumeStart: 98, consumeEnd: 109 },
  AGO: { meterHeader: 117, pumpStart: 119, pumpEnd: 146, pourBackStart: 150, pourBackEnd: 155, consumeStart: 159, consumeEnd: 175 },
  DPK: { meterHeader: 183, pumpStart: 185, pumpEnd: 207, pourBackStart: 211, pourBackEnd: 216, consumeStart: 220, consumeEnd: 222 },
}
const EXTENDED_SECTIONS = {
  PMS: { meterHeader: 8, pumpStart: 10, pumpEnd: 163, pourBackStart: 167, pourBackEnd: 171, consumeStart: 175, consumeEnd: 186 },
  AGO: { meterHeader: 194, pumpStart: 196, pumpEnd: 251, pourBackStart: 255, pourBackEnd: 260, consumeStart: 264, consumeEnd: 280 },
  DPK: { meterHeader: 288, pumpStart: 290, pumpEnd: 335, pourBackStart: 339, pourBackEnd: 344, consumeStart: 348, consumeEnd: 350 },
}

/** Check if any fuel type needs more pump rows than the regular template */
function needsExtended(report, nozzles) {
  if (!report?.salesCash) return false
  for (const ft of report.fuelTypes || []) {
    const summary = report.salesCash.fuelSummaries[ft]
    if (!summary) continue
    const pumpCount = nozzles.filter(n => n.fuel_type === ft).length
    const blockSize = pumpCount + 1
    const rowsNeeded = summary.rows.length * blockSize
    const sec = REGULAR_SECTIONS[ft]
    if (sec && rowsNeeded > sec.pumpEnd - sec.pumpStart + 1) return true
  }
  return false
}

export async function exportAuditExcel({
  report, receipts, lubeSales, lubeStock, lubeProducts,
  tanks, nozzles, stationName, startDate, endDate, templateUrl,
}) {
  let useExtended = needsExtended(report, nozzles)

  // Try to load extended template first if needed; fall back to regular
  let buf
  if (useExtended) {
    try {
      const resp = await fetch('/templates/AUDIT REPORT TEMPLATE (EXTENDED).xlsx')
      if (resp.ok) buf = await resp.arrayBuffer()
    } catch { /* fall through to regular */ }
  }
  if (!buf) {
    useExtended = false
    // Prefer admin-uploaded URL, fall back to public/templates
    if (templateUrl) {
      try {
        const resp = await fetch(templateUrl)
        if (resp.ok) buf = await resp.arrayBuffer()
      } catch { /* fall through to fallback */ }
    }
    if (!buf) {
      const resp = await fetch('/templates/AUDIT REPORT TEMPLATE.xlsx')
      if (!resp.ok) throw new Error('Failed to load Excel template')
      buf = await resp.arrayBuffer()
    }
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)

  const sections = useExtended ? EXTENDED_SECTIONS : REGULAR_SECTIONS

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

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Audit Report ${startDate} to ${endDate}.xlsx`
  a.click()
  URL.revokeObjectURL(url)

  return { warnings }
}

// ─── Helpers ───────────────────────────────────────────────

/** Set a cell value, preserving formula cells and existing formatting */
function set(ws, addr, value) {
  if (value == null || value === '') return
  const cell = ws.getCell(addr)
  if (cell.formula || cell.sharedFormula) return
  cell.value = value
}

/** Set a cell by 1-indexed row and column */
function setAt(ws, r, c, value) {
  if (value == null || value === '') return
  const cell = ws.getRow(r).getCell(c)
  if (cell.formula || cell.sharedFormula) return
  cell.value = value
}

/** Clear all non-formula cells in a range (1-indexed) */
function clearRange(ws, startRow, endRow, cols) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (const c of cols) {
      const cell = row.getCell(c)
      if (!cell.formula && !cell.sharedFormula) cell.value = null
    }
  }
}

/** Convert YYYY-MM-DD to JS Date for ExcelJS */
function toDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

// 1-indexed column constants (A=1, B=2, ...)
const B = 2, C = 3, D = 4, E = 5, F = 6, G = 7, H = 8
const I = 9, J = 10, K = 11, L = 12, M = 13, N = 14, O = 15, P = 16
const Q = 17, R = 18, S = 19, T = 20, U = 21, V = 22

// ─── Sheet 2: Sales/Cash Position ──────────────────────────
//
// Layout per fuel type:
//   Pump meter blocks: each block = pumpCount rows + 1 spacer row
//   Data cells per pump row: B(label), C(opening), D(closing), F(price)
//   E(dispensed) = formula D-C, G(amount) = formula E*F
//   Pour back detail rows: C(name), E(qty), F(price), G(amount)
//   Consumption detail rows: same layout
//   Summary rows (A, B, C=A-B, D, E=C-D) are all formulas

function fillSalesCash(wb, report, nozzles, stationName, startDate, endDate, fmtDate, sections, warnings) {
  const ws = wb.getWorksheet('2. Sales>>Cash Position')
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
    const blockSize = pumpCount + 1
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

function fillStockSummary(wb, report, stationName, startDate, endDate, fmtDate) {
  const ws = wb.getWorksheet('3.Stock Position')
  if (!ws || !report?.stockPosition) return

  set(ws, 'C2', `AUDIT REPORT FOR : ${stationName || ''}`)
  set(ws, 'C3', `STOCK POSITION FOR THE PERIOD (${fmtDate(startDate)}- ${fmtDate(endDate)})`)

  // 1-indexed header rows
  const fuelHeaders = { PMS: 6, AGO: 32, DPK: 59 }

  const { stockPosition, fuelTypes } = report

  for (const ft of fuelTypes) {
    const h = fuelHeaders[ft]
    if (h == null) continue
    const data = stockPosition[ft]
    if (!data) continue
    const t = data.totals

    setAt(ws, h + 1, C, `OPENING STOCK (${fmtDate(startDate)})`)
    setAt(ws, h + 7, C, `CLOSING STOCK (${fmtDate(endDate)})`)

    setAt(ws, h + 1, D, t.opening)
    setAt(ws, h + 3, D, t.supply)
    setAt(ws, h + 7, D, t.closing)
    setAt(ws, h + 11, D, t.dispensed)
    setAt(ws, h + 17, D, t.expectedLitres)
    setAt(ws, h + 19, D, t.actualLitresReceived)
  }
}

// ─── Sheet 4: Lodgement Sheet ──────────────────────────────

function fillLodgement(wb, report, startDate, endDate, stationName) {
  const ws = wb.getWorksheet('4.Lodgement Sheet')
  if (!ws || !report?.lodgementSheet) return

  const { rows, banks } = report.lodgementSheet

  set(ws, 'C2', stationName || '')

  const posBanks = banks.filter(b => b.lodgement_type === 'pos').slice(0, 8)

  // Write bank headers (1-indexed row 9)
  clearRange(ws, 9, 9, [I, J, K, L, M, N, O, P])
  for (let i = 0; i < posBanks.length; i++) {
    setAt(ws, 9, I + i, posBanks[i].bank_name)
  }

  // Clear data rows (1-indexed 11-171)
  clearRange(ws, 11, 171, [B, E, G, I, J, K, L, M, N, O, P, R, T, U, V])

  // Fill — 3 rows per date
  const visibleRows = rows.filter(r => r.hasData)
  for (let i = 0; i < visibleRows.length && i < 54; i++) {
    const row = visibleRows[i]
    const r1 = 11 + i * 3
    const r2 = r1 + 1

    setAt(ws, r1, B, toDate(row.date))
    setAt(ws, r1, E, row.totalSales - row.totalPOS)
    for (let j = 0; j < posBanks.length; j++) {
      setAt(ws, r1, I + j, row.bankAmounts[posBanks[j].id] || 0)
    }

    setAt(ws, r2, T, row.actual)
    setAt(ws, r2, V, toDate(row.date))
  }
}

// ─── Sheets 5/6/7: Consumption & Pour Back ─────────────────

function fillConsumptionSheets(wb, report) {
  if (!report?.consumptionReport) return

  // 1-indexed rows
  const configs = {
    PMS: { sheet: '5.PMS Consumption and Pour back', headerRow: 5, dataStart: 6, totalsRow: 36, maxCust: 9 },
    AGO: { sheet: '6.AGO Consumption and Pour back', headerRow: 5, dataStart: 6, totalsRow: 38, maxCust: 5 },
    DPK: { sheet: '7.DPK Consumption and Pour back', headerRow: 6, dataStart: 7, totalsRow: 37, maxCust: 5 },
  }

  for (const [ft, cfg] of Object.entries(configs)) {
    const ws = wb.getWorksheet(cfg.sheet)
    if (!ws) continue
    const data = report.consumptionReport[ft]
    if (!data) continue

    const { customers, rows, totals } = data
    const custSlice = customers.slice(0, cfg.maxCust)
    const pourBackCol = D + custSlice.length

    // Clear header row customer columns
    for (let c = D; c <= D + cfg.maxCust + 1; c++) {
      const cell = ws.getRow(cfg.headerRow).getCell(c)
      if (!cell.formula && !cell.sharedFormula) cell.value = null
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

    // Fill data rows
    const visibleRows = rows.filter(r => r.hasData)
    for (let i = 0; i < visibleRows.length; i++) {
      const r = cfg.dataStart + i
      if (r >= cfg.totalsRow) break
      const row = visibleRows[i]
      setAt(ws, r, B, toDate(row.date))
      setAt(ws, r, C, row.rate)
      for (let j = 0; j < custSlice.length; j++) {
        setAt(ws, r, D + j, row.customerQtys[custSlice[j].id] || 0)
      }
      setAt(ws, r, pourBackCol, row.pourBack || 0)
    }

    // Fill totals row
    setAt(ws, cfg.totalsRow, B, 'Total')
    for (let j = 0; j < custSlice.length; j++) {
      setAt(ws, cfg.totalsRow, D + j, totals.customerTotals[custSlice[j].id] || 0)
    }
    setAt(ws, cfg.totalsRow, pourBackCol, totals.pourBack || 0)
  }
}

// ─── Sheet 8: Product Received ─────────────────────────────

function fillProductReceived(wb, receipts, tanks, startDate, endDate) {
  const ws = wb.getWorksheet('8.Product Received')
  if (!ws) return

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

  // Clear data area (1-indexed 9-51)
  clearRange(ws, 9, 51, [B, C, D, F, I, K, N, P])

  const dates = Object.keys(byDate).sort()
  for (let i = 0; i < dates.length && i < 43; i++) {
    const r = 9 + i
    const date = dates[i]
    const entries = byDate[date]

    setAt(ws, r, B, toDate(date))
    setAt(ws, r, C, toDate(date))

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

function fillRecordOfStock(wb, report) {
  const ws = wb.getWorksheet('10.Record of Stock Position')
  if (!ws || !report?.stockPosition) return

  const { stockPosition, fuelTypes } = report

  const fuelCols = {
    PMS: { date: B, opening: C, supply: D, qtySold: E, closing: F },
    AGO: { date: H, opening: I, supply: J, qtySold: K, closing: L },
    DPK: { date: N, opening: O, supply: P, qtySold: Q, closing: R },
  }

  // Clear all data (1-indexed 8-38)
  for (const cols of Object.values(fuelCols)) {
    clearRange(ws, 8, 38, Object.values(cols))
  }

  for (const ft of fuelTypes) {
    const data = stockPosition[ft]
    if (!data) continue
    const cols = fuelCols[ft]
    if (!cols) continue

    const visibleRows = data.rows.filter(r => r.hasData)
    for (let i = 0; i < visibleRows.length && i < 30; i++) {
      const r = 8 + i
      const row = visibleRows[i]
      setAt(ws, r, cols.date, toDate(row.date))
      setAt(ws, r, cols.opening, row.opening)
      if (row.supply) setAt(ws, r, cols.supply, row.supply)
      setAt(ws, r, cols.qtySold, row.qtySold)
      setAt(ws, r, cols.closing, row.closing)
    }
  }
}

// ─── Castro Lubricants ─────────────────────────────────────

function fillLubricants(wb, lubeSales, lubeStock, lubeProducts, stationName, startDate, endDate, fmtDate) {
  const ws = wb.getWorksheet('Castro Lubricants')
  if (!ws || !lubeProducts?.length) return

  set(ws, 'B3', `LUBRICANTS AS AT ${fmtDate(endDate)} - ${stationName || ''}`)

  // Clear data rows (1-indexed 5-29, don't touch G and J which are formulas)
  clearRange(ws, 5, 29, [B, C, D, E, F, H, I])

  const products = [...lubeProducts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const stockSorted = [...(lubeStock || [])].sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  for (let i = 0; i < products.length && i < 25; i++) {
    const r = 5 + i
    const prod = products[i]

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

    setAt(ws, r, B, i + 1)
    setAt(ws, r, C, prod.product_name)
    setAt(ws, r, E, openingStock)
    if (purchase) setAt(ws, r, F, purchase)
    setAt(ws, r, H, closingStock)
    setAt(ws, r, I, Number(prod.unit_price || 0))
  }
}
