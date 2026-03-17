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

  // Force Excel to recalculate all formulas when the file is opened
  wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true }

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

/** Write a value only to non-formula cells.
 *  Formula cells (E=dispensed, G=amount, J=lube value) are skipped entirely —
 *  fullCalcOnLoad makes Excel recalculate them from the data we filled in. */
function forceSetAt(ws, r, c, value) {
  if (value == null) return
  const cell = ws.getRow(r).getCell(c)
  // Skip any formula/shared-formula cell — ExcelJS serialization crashes if
  // cell.formula is undefined when it calls .replace() on the formula string.
  if (cell.type === 6 /* Formula */ || cell.formula || cell.sharedFormula) return
  cell.value = value
}

/** Unconditionally write a value — even if the cell is a formula.
 *  Setting cell.value = <number> removes any existing formula entirely,
 *  which is safe because we have fullCalcOnLoad disabled for these cells anyway. */
function forceWriteAt(ws, r, c, value) {
  if (value == null) return
  ws.getRow(r).getCell(c).value = value
}

/** Clear non-formula cells in a range (1-indexed) */
function clearRange(ws, startRow, endRow, cols) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (const c of cols) {
      const cell = row.getCell(c)
      if (!cell.formula && !cell.sharedFormula) cell.value = null
    }
  }
}

/** Clear all cells in a range unconditionally — including formula cells.
 *  Safe: setting cell.value = null removes the formula entirely, which avoids
 *  ExcelJS serialization crashes (those only occur with {formula:undefined, result:x}). */
function forceClearRange(ws, startRow, endRow, cols) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (const c of cols) {
      row.getCell(c).value = null
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
//   E (dispensed=D-C) and G (amount=E*F) are formula cells — left alone, recalculated by Excel
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
    // E (dispensed) and G (amount) are formula cells — skip them, fullCalcOnLoad handles recalc
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
        // E (dispensed=D-C) and G (amount=E*F) are formula cells — leave them for Excel
        setAt(ws, r, F, period.price)
      }
    }

    // Fill pour back detail rows — force-clear first (removes stale cached formula results),
    // then match by name from column C and write fresh values
    // G (amount=E*F) is a formula cell — only clear and write E (qty) and F (price)
    clearRange(ws, sec.pourBackStart, sec.pourBackEnd, [E, F])
    const pourBackEntries = summary.consumption?.pourBack || []
    const pourBackByName = {}
    for (const e of pourBackEntries) {
      const key = (e.name || '').trim().toLowerCase()
      if (!pourBackByName[key]) pourBackByName[key] = { qty: 0, price: 0 }
      pourBackByName[key].qty += e.qty
      if (e.price) pourBackByName[key].price = e.price
    }
    for (let r = sec.pourBackStart; r <= sec.pourBackEnd; r++) {
      const templateName = String(ws.getRow(r).getCell(C).value || '').trim()
      if (!templateName) continue
      const match = pourBackByName[templateName.toLowerCase()]
      if (match && match.qty) {
        setAt(ws, r, E, match.qty)
        setAt(ws, r, F, match.price)
      }
    }

    // Fill consumption detail rows — same pattern, G is formula
    clearRange(ws, sec.consumeStart, sec.consumeEnd, [E, F])
    const consumeEntries = summary.consumption?.consumed || []
    const consumeByName = {}
    for (const e of consumeEntries) {
      const key = (e.name || '').trim().toLowerCase()
      if (!consumeByName[key]) consumeByName[key] = { qty: 0, price: 0 }
      consumeByName[key].qty += e.qty
      if (e.price) consumeByName[key].price = e.price
    }
    for (let r = sec.consumeStart; r <= sec.consumeEnd; r++) {
      const templateName = String(ws.getRow(r).getCell(C).value || '').trim()
      if (!templateName) continue
      const match = consumeByName[templateName.toLowerCase()]
      if (match && match.qty) {
        setAt(ws, r, E, match.qty)
        setAt(ws, r, F, match.price)
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
    const stockAvailable = t.opening + t.supply

    setAt(ws, h + 1, C, `OPENING STOCK (${fmtDate(startDate)})`)
    setAt(ws, h + 7, C, `CLOSING STOCK (${fmtDate(endDate)})`)

    // All D column cells are formulas referencing other sheets —
    // leave them for Excel to calculate via fullCalcOnLoad.
  }
}

// ─── Sheet 4: Lodgement Sheet ──────────────────────────────

function fillLodgement(wb, report, startDate, endDate, stationName) {
  const ws = wb.getWorksheet('4.Lodgement Sheet')
  if (!ws || !report?.lodgementSheet) return

  const { rows, banks } = report.lodgementSheet

  set(ws, 'C2', stationName || '')

  const posBanks = banks.filter(b => b.lodgement_type === 'pos' || b.lodgement_type === 'transfer').slice(0, 8)

  // Write bank headers (1-indexed row 9)
  clearRange(ws, 9, 9, [I, J, K, L, M, N, O, P])
  for (let i = 0; i < posBanks.length; i++) {
    setAt(ws, 9, I + i, posBanks[i].bank_name)
  }

  // Clear data rows (1-indexed 11-171) — include Total Sales(C), Total POS(Q), Expected(S)
  clearRange(ws, 11, 171, [B, C, E, G, I, J, K, L, M, N, O, P, Q, R, S, T, U, V])

  // Fill — 3 rows per date
  const visibleRows = rows.filter(r => r.hasData)
  for (let i = 0; i < visibleRows.length && i < 54; i++) {
    const row = visibleRows[i]
    const r1 = 11 + i * 3
    const r2 = r1 + 1

    const cashSales = row.totalSales - row.totalPOS - (row.totalTransfer || 0)

    setAt(ws, r1, B, toDate(row.date))
    setAt(ws, r1, C, row.totalSales)                              // Total Sales
    setAt(ws, r1, E, cashSales)                                    // Cash Sales
    for (let j = 0; j < posBanks.length; j++) {
      setAt(ws, r1, I + j, row.bankAmounts[posBanks[j].id] || 0)
    }
    setAt(ws, r1, Q, row.totalPOS + (row.totalTransfer || 0))     // P.O.S (includes transfers)
    setAt(ws, r1, S, cashSales)                                    // Expected Lodgement

    setAt(ws, r2, T, row.actual)
    setAt(ws, r2, V, toDate(row.date))
  }
}

// ─── Sheets 5/6/7: Consumption & Pour Back ─────────────────

function fillConsumptionSheets(wb, report) {
  if (!report?.consumptionReport) return

  // 1-indexed rows
  const configs = {
    PMS: { sheet: '5.PMS Consumption and Pour back', headerRow: 5, dataStart: 6, totalsRow: 36 },
    AGO: { sheet: '6.AGO Consumption and Pour back', headerRow: 5, dataStart: 6, totalsRow: 38 },
    DPK: { sheet: '7.DPK Consumption and Pour back', headerRow: 6, dataStart: 7, totalsRow: 37 },
  }

  for (const [ft, cfg] of Object.entries(configs)) {
    const ws = wb.getWorksheet(cfg.sheet)
    if (!ws) continue
    const data = report.consumptionReport[ft]
    if (!data) continue

    const { customers, rows, totals } = data

    // Read existing column headers from the template (preserve them)
    const headerRow = ws.getRow(cfg.headerRow)
    const templateHeaders = [] // { col, name }
    let pourBackCol = null
    for (let c = D; c <= 30; c++) {
      const val = headerRow.getCell(c).value
      if (val == null || val === '') break
      const name = String(val).trim()
      if (name.toLowerCase().replace(/\s/g, '') === 'pourback') {
        pourBackCol = c
        break
      }
      templateHeaders.push({ col: c, name })
    }

    // Map template header names to customer IDs from report data
    const colMap = [] // { col, customerId }
    for (const h of templateHeaders) {
      const match = customers.find(c => c.name.toLowerCase() === h.name.toLowerCase())
      if (match) colMap.push({ col: h.col, customerId: match.id })
    }

    // Clear data + totals area (only date, rate, mapped columns, pour back)
    const clearCols = [B, C, ...colMap.map(m => m.col)]
    if (pourBackCol) clearCols.push(pourBackCol)
    clearRange(ws, cfg.dataStart, cfg.totalsRow, clearCols)

    // Fill data rows
    const visibleRows = rows.filter(r => r.hasData)
    for (let i = 0; i < visibleRows.length; i++) {
      const r = cfg.dataStart + i
      if (r >= cfg.totalsRow) break
      const row = visibleRows[i]
      setAt(ws, r, B, toDate(row.date))
      setAt(ws, r, C, row.rate)
      for (const m of colMap) {
        const val = row.customerQtys[m.customerId] || 0
        if (val) setAt(ws, r, m.col, val)
      }
      if (pourBackCol && row.pourBack) setAt(ws, r, pourBackCol, row.pourBack)
    }

    // Fill totals row
    setAt(ws, cfg.totalsRow, B, 'Total')
    for (const m of colMap) {
      const val = totals.customerTotals[m.customerId] || 0
      if (val) setAt(ws, cfg.totalsRow, m.col, val)
    }
    if (pourBackCol) setAt(ws, cfg.totalsRow, pourBackCol, totals.pourBack || 0)
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
  if (!ws) return

  set(ws, 'B3', `LUBRICANTS AS AT ${fmtDate(endDate)} - ${stationName || ''}`)

  // Clear value columns (G/J were formulas but we now force-write computed values)
  clearRange(ws, 5, 29, [E, F, H, I])

  if (!lubeProducts?.length) return

  const products = [...lubeProducts].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const stockSorted = [...(lubeStock || [])].sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

  // Build lookup by product name (lowercase) for matching template rows
  const prodByName = {}
  for (const prod of products) {
    const key = (prod.product_name || '').trim().toLowerCase()
    if (key) prodByName[key] = prod
  }

  // Read template product names from column C, match by name, fill values
  for (let r = 5; r <= 29; r++) {
    const templateName = String(ws.getRow(r).getCell(C).value || '').trim()
    if (!templateName) continue

    const prod = prodByName[templateName.toLowerCase()]
    if (!prod) continue

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

    setAt(ws, r, E, openingStock)
    if (purchase) setAt(ws, r, F, purchase)
    // G (unitsSold) and J (value) are formula cells — leave them for Excel
    setAt(ws, r, H, closingStock)
    setAt(ws, r, I, unitPrice)
  }
}
