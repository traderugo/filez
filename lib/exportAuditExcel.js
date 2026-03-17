import ExcelJS from 'exceljs'

/**
 * Export audit report data to Excel.
 *
 * Strategy: load the template as a READ-ONLY reference, build a fresh workbook
 * that replicates the template's styling / merges / formulas, then fill in the
 * report data.  This avoids ExcelJS shared-formula corruption entirely because
 * the new workbook only contains individual formulas.
 *
 * Formula cells are locked and sheets are protected so users can't accidentally
 * overwrite calculations.
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

  // Load template as read-only reference
  const templateWb = new ExcelJS.Workbook()
  await templateWb.xlsx.load(buf)

  // Build a fresh workbook from the template — copies styling, merges,
  // static labels, and converts ALL formulas to individual formulas.
  const wb = buildFromTemplate(templateWb)

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

  // Lock formula cells and protect sheets
  lockFormulaCells(wb)

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

// ─── Build from Template ──────────────────────────────────
//
// Creates a brand-new workbook that replicates the template's appearance.
// Shared formulas are resolved into individual formulas so ExcelJS never
// has a chance to corrupt them during serialization.

function buildFromTemplate(source) {
  // Step 1 — resolve shared formulas in the source (in-memory only)
  const sharedMap = collectSharedFormulas(source)

  // Step 2 — create fresh workbook
  const wb = new ExcelJS.Workbook()
  wb.calcProperties = { fullCalcOnLoad: true }

  for (const srcWs of source.worksheets) {
    const ws = wb.addWorksheet(srcWs.name, {
      properties: srcWs.properties ? { ...srcWs.properties } : {},
      pageSetup: srcWs.pageSetup ? { ...srcWs.pageSetup } : {},
    })

    // Column widths + hidden state
    for (let c = 1; c <= (srcWs.columnCount || 0); c++) {
      const srcCol = srcWs.getColumn(c)
      const col = ws.getColumn(c)
      if (srcCol.width) col.width = srcCol.width
      if (srcCol.hidden) col.hidden = srcCol.hidden
    }

    // Merged cells — must come before cell values
    if (srcWs.model?.merges) {
      for (const merge of srcWs.model.merges) {
        ws.mergeCells(merge)
      }
    }

    // Rows + cells
    srcWs.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
      const row = ws.getRow(rowNum)
      if (srcRow.height) row.height = srcRow.height
      if (srcRow.hidden) row.hidden = srcRow.hidden

      srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
        const cell = row.getCell(colNum)

        // Copy style (font, fill, border, alignment, numFmt, protection)
        try { cell.style = JSON.parse(JSON.stringify(srcCell.style)) } catch { /* safe fallback */ }

        // Skip merge slaves — their value lives on the master cell
        if (srcCell.isMerged && srcCell.address !== srcCell.master?.address) return

        // Formula cells — write as individual formula (never shared)
        if (srcCell.formula) {
          cell.value = { formula: srcCell.formula }
          return
        }

        // Shared formula dependents — translate master's formula by offset
        const sfKey = `${srcWs.name}!${srcCell.address}`
        const sfRef = srcCell.model?.sharedFormula ?? srcCell.sharedFormula
        if (sfRef) {
          const masterKey = `${srcWs.name}!${sfRef}`
          const master = sharedMap.get(masterKey)
          if (master) {
            const rowOff = rowNum - master.row
            const colOff = colNum - master.col
            const translated = translateFormula(master.formula, rowOff, colOff)
            cell.value = { formula: translated }
            return
          }
        }

        // Plain value
        cell.value = srcCell.value
      })
    })

    // Sheet views (frozen panes, zoom, etc.)
    if (srcWs.views?.length) {
      ws.views = JSON.parse(JSON.stringify(srcWs.views))
    }
  }

  return wb
}

/** Collect all shared formula masters across every sheet */
function collectSharedFormulas(wb) {
  const masters = new Map()
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (cell.formula && cell.model && cell.model.shareType === 'shared') {
          masters.set(`${ws.name}!${cell.address}`, {
            formula: cell.formula,
            row: rowNumber,
            col: colNumber,
          })
        }
      })
    })
  }
  return masters
}

/** Translate a formula by row/col offset, respecting $ (absolute) markers */
function translateFormula(formula, rowOffset, colOffset) {
  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_m, dCol, col, dRow, row) => {
    const newCol = dCol === '$' ? col : shiftCol(col, colOffset)
    const newRow = dRow === '$' ? row : String(parseInt(row, 10) + rowOffset)
    return `${dCol}${newCol}${dRow}${newRow}`
  })
}

function shiftCol(col, offset) {
  if (offset === 0) return col
  let num = 0
  for (let i = 0; i < col.length; i++) num = num * 26 + (col.charCodeAt(i) - 64)
  num += offset
  let result = ''
  while (num > 0) { num--; result = String.fromCharCode(65 + (num % 26)) + result; num = Math.floor(num / 26) }
  return result
}

// ─── Cell Locking ─────────────────────────────────────────
//
// Lock every formula cell and protect each sheet so users can only
// edit data-entry cells.

function lockFormulaCells(wb) {
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const isFormula = !!cell.formula
        cell.protection = { locked: isFormula }
      })
    })

    // Enable sheet protection (no password — prevents accidental edits only)
    ws.sheetProtection = {
      sheet: true,
      objects: true,
      scenarios: true,
      selectLockedCells: false,
      selectUnlockedCells: false,
    }
  }
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

/** Clear all cells in a range unconditionally — including formula cells */
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
//   E (dispensed=D-C) and G (amount=E*F) are formula cells — left for Excel
//   Pour back detail rows: C(name), E(qty), F(price), G(amount=formula)
//   Consumption detail rows: same layout
//   Summary rows are all formulas

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
    let lastUsedRow = sec.pumpStart - 1
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
        // E and G are individual formulas from buildFromTemplate — left alone
        lastUsedRow = r
      }
    }

    // Clear unused rows (data + formulas) so stale template values don't show
    if (lastUsedRow < sec.pumpEnd) {
      forceClearRange(ws, lastUsedRow + 1, sec.pumpEnd, [B, C, D, E, F, G])
    }

    // Fill pour back detail rows — match by template name in column C
    // G (amount=E*F) is a formula — only write E (qty) and F (price)
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

    // Fill consumption detail rows — same pattern
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

    setAt(ws, h + 1, C, `OPENING STOCK (${fmtDate(startDate)})`)
    setAt(ws, h + 7, C, `CLOSING STOCK (${fmtDate(endDate)})`)

    // All D column cells are cross-sheet formulas (individual, from buildFromTemplate) —
    // Excel recalculates them via fullCalcOnLoad.
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

  // Clear data rows (1-indexed 11-171)
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

  // Clear input columns only — G (unitsSold) and J (value) are formulas
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

    setAt(ws, r, E, openingStock)
    if (purchase) setAt(ws, r, F, purchase)
    // G (unitsSold=E+F-H) and J (value=G*I) are formula cells — left for Excel
    setAt(ws, r, H, closingStock)
    setAt(ws, r, I, Number(prod.unit_price || 0))
  }
}
