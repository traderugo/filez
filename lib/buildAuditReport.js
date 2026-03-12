import { sortEntries, getFuelTypes, getNozzlesForFuel } from './salesCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'
import { calculateDateRangeConsumption } from './consumptionCalculations'

/**
 * Build the audit report (Sales/Cash Position sub-report) for a date range.
 *
 * Pure function — no side effects, no state, no DOM.
 *
 * The meter reading logic:
 * - Each row represents a price period, not a day.
 * - On days with multiple entries (price changes), each entry becomes a separate row.
 * - On days with a single entry, the closing extends the current period.
 * - Opening of row N = closing of row N-1 (or initial reading for the very first).
 *
 * @param {Object} params
 * @param {Array}  params.sales       - All dailySales entries for the org
 * @param {Array}  params.lodgements  - All lodgement entries for the org
 * @param {Array}  params.consumption - All consumption entries for the org
 * @param {Array}  params.nozzles     - Nozzle config objects
 * @param {Array}  params.banks       - Bank config objects
 * @param {Array}  params.customers   - Customer config objects (for names)
 * @param {string} params.startDate   - YYYY-MM-DD
 * @param {string} params.endDate     - YYYY-MM-DD
 * @returns {Object}
 */
export function buildAuditReport({ sales, lodgements, consumption, nozzles, banks, customers, startDate, endDate }) {
  if (!nozzles.length) return null

  const fuelTypes = getFuelTypes(nozzles)
  const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c.name || 'Unknown']))

  const salesCash = buildSalesCashPosition({
    sales, lodgements, consumption, nozzles, banks, fuelTypes, customerMap, startDate, endDate,
  })

  return { fuelTypes, salesCash }
}

/**
 * Build the Sales/Cash Position sub-report.
 */
function buildSalesCashPosition({ sales, lodgements, consumption, nozzles, banks, fuelTypes, customerMap, startDate, endDate }) {
  const sorted = sortEntries(sales)

  // Find the last entry before startDate for opening meter readings
  let prevEntry = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].entryDate < startDate) { prevEntry = sorted[i]; break }
  }

  // Filter entries within the date range
  const rangeEntries = sorted.filter(e => e.entryDate >= startDate && e.entryDate <= endDate)

  // Generate date strings in range (used by getPriceForDate)
  const dateStrings = getDateRange(startDate, endDate)

  // Build meter reading rows per fuel type.
  // Pre-process entries into a simple per-fuel structure, then walk sequentially.
  const fuelData = {}
  for (const ft of fuelTypes) {
    const ftNozzles = getNozzlesForFuel(nozzles, ft)
    const pumpIds = ftNozzles.map(n => n.id)

    // Pre-process: extract only what we need per entry for this fuel type
    const processed = rangeEntries.map(e => {
      const closings = {}
      for (const pid of pumpIds) {
        const r = (e.nozzleReadings || []).find(r => r.pump_id === pid)
        if (r) closings[pid] = Number(r.closing_meter || 0)
      }
      return { price: Number(e.prices?.[ft] || 0), closings }
    })

    // Resolve opening per pump from prevEntry or initial_reading
    const openings = {}
    for (const n of ftNozzles) {
      if (prevEntry) {
        const r = (prevEntry.nozzleReadings || []).find(r => r.pump_id === n.id)
        if (r) { openings[n.id] = Number(r.closing_meter || 0); continue }
      }
      openings[n.id] = Number(n.initial_reading || 0)
    }

    // Resolve initial price: from prevEntry, or first entry with a price
    let initPrice = Number(prevEntry?.prices?.[ft] || 0)
    if (!initPrice) {
      for (const p of processed) {
        if (p.price) { initPrice = p.price; break }
      }
    }

    // Fill in missing prices (entries without a price for this fuel inherit the last known price)
    let lastKnown = initPrice
    for (const p of processed) {
      if (p.price) { lastKnown = p.price }
      else { p.price = lastKnown }
    }

    fuelData[ft] = buildFuelMeterRows(ft, ftNozzles, pumpIds, processed, openings, initPrice)

    // DEBUG: remove after verifying
    if (ft === 'PMS') {
      console.log(`[AUDIT DEBUG] PMS pre-processed entries (${processed.length}):`)
      processed.forEach((p, i) => console.log(`  [${i}] price=${p.price}, closings=`, p.closings))
      console.log(`[AUDIT DEBUG] PMS openings:`, openings)
      console.log(`[AUDIT DEBUG] PMS initPrice:`, initPrice)
      console.log(`[AUDIT DEBUG] PMS rows:`)
      fuelData[ft].rows.forEach((r, i) => {
        console.log(`  Row ${i}: price=${r.price}, dispensed=${r.dispensed}, amount=${r.amount}`)
        r.pumps.forEach(p => console.log(`    ${p.label}: open=${p.opening} close=${p.closing} disp=${p.dispensed}`))
      })
      console.log(`[AUDIT DEBUG] PMS totals: qty=${fuelData[ft].rows.reduce((s,r) => s+r.dispensed, 0)}, amt=${fuelData[ft].rows.reduce((s,r) => s+r.amount, 0)}`)
    }
  }

  // Build price-by-date lookup from daily sales entries.
  // For each date+fuelType, use the last entry's price (handles multiple entries per day).
  const priceByDate = {}
  for (const e of rangeEntries) {
    if (!e.prices) continue
    priceByDate[e.entryDate] = priceByDate[e.entryDate] || {}
    for (const ft of fuelTypes) {
      const p = Number(e.prices[ft] || 0)
      if (p) priceByDate[e.entryDate][ft] = p
    }
  }

  // Helper: get the active price for a fuel type on a given date.
  // Falls back to the nearest earlier date with a price, then the nearest later date.
  function getPriceForDate(fuelType, date) {
    if (priceByDate[date]?.[fuelType]) return priceByDate[date][fuelType]
    // Search backwards then forwards
    for (let i = dateStrings.indexOf(date) - 1; i >= 0; i--) {
      if (priceByDate[dateStrings[i]]?.[fuelType]) return priceByDate[dateStrings[i]][fuelType]
    }
    for (let i = dateStrings.indexOf(date) + 1; i < dateStrings.length; i++) {
      if (priceByDate[dateStrings[i]]?.[fuelType]) return priceByDate[dateStrings[i]][fuelType]
    }
    // Last resort: use last meter row price
    return 0
  }

  // Consumption & pour back (from dedicated consumption entries, across full range)
  const consumptionResult = calculateDateRangeConsumption(consumption, startDate, endDate)
  const consumptionByFuel = {}
  for (const ft of fuelTypes) {
    consumptionByFuel[ft] = { consumed: [], pourBack: [], totalConsumedQty: 0, totalConsumedAmt: 0, totalPourBackQty: 0, totalPourBackAmt: 0 }
  }
  for (const dayData of consumptionResult.dates) {
    for (const e of dayData.entries) {
      const ft = e.fuelType
      if (!consumptionByFuel[ft]) continue
      const qty = Number(e.quantity || 0)
      const price = Number(e.price) || getPriceForDate(ft, e.entryDate || dayData.date)
      const amt = qty * price
      const name = customerMap[e.customerId] || 'Unknown'
      if (e.isPourBack) {
        consumptionByFuel[ft].pourBack.push({ name, qty, price, amt, customerId: e.customerId })
        consumptionByFuel[ft].totalPourBackQty += qty
        consumptionByFuel[ft].totalPourBackAmt += amt
      } else {
        consumptionByFuel[ft].consumed.push({ name, qty, price, amt, customerId: e.customerId })
        consumptionByFuel[ft].totalConsumedQty += qty
        consumptionByFuel[ft].totalConsumedAmt += amt
      }
    }
  }

  // Group entries by price for subtotals per price group
  function groupByPrice(entries) {
    const map = {}
    for (const e of entries) {
      const key = e.price
      if (!map[key]) map[key] = { price: e.price, entries: [], totalQty: 0, totalAmt: 0 }
      map[key].entries.push(e)
      map[key].totalQty += e.qty
      map[key].totalAmt += e.amt
    }
    return Object.values(map).sort((a, b) => a.price - b.price)
  }

  for (const ft of fuelTypes) {
    consumptionByFuel[ft].consumedByPrice = groupByPrice(consumptionByFuel[ft].consumed)
    consumptionByFuel[ft].pourBackByPrice = groupByPrice(consumptionByFuel[ft].pourBack)
  }

  // Build per-fuel summary
  const fuelSummaries = {}
  for (const ft of fuelTypes) {
    const rows = fuelData[ft].rows
    const totalDispensed = rows.reduce((s, r) => s + r.dispensed, 0)
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0)

    const totalPourBackQty = consumptionByFuel[ft].totalPourBackQty
    const totalPourBackAmt = consumptionByFuel[ft].totalPourBackAmt

    const netSalesQty = totalDispensed - totalPourBackQty
    const netSalesAmt = totalAmount - totalPourBackAmt

    const totalConsumedQty = consumptionByFuel[ft].totalConsumedQty
    const totalConsumedAmt = consumptionByFuel[ft].totalConsumedAmt

    const expectedSalesQty = netSalesQty - totalConsumedQty
    const expectedSalesAmt = netSalesAmt - totalConsumedAmt

    fuelSummaries[ft] = {
      rows,
      totalDispensed,
      totalAmount,
      totalPourBackQty,
      totalPourBackAmt,
      netSalesQty,
      netSalesAmt,
      totalConsumedQty,
      totalConsumedAmt,
      expectedSalesQty,
      expectedSalesAmt,
      consumption: consumptionByFuel[ft],
    }
  }

  // Cash reconciliation
  const lodgementResult = calculateDateRangeLodgements(lodgements, banks, startDate, endDate)
  let totalLodgement = 0
  let totalPOS = 0
  for (const dayData of lodgementResult.dates) {
    totalLodgement += dayData.totalDeposits + dayData.totalCash + dayData.totalOther
    totalPOS += dayData.totalPOS
  }

  const expectedSalesTotal = fuelTypes.reduce((s, ft) => s + fuelSummaries[ft].expectedSalesAmt, 0)
  const overshort = expectedSalesTotal - totalLodgement - totalPOS

  const cashReconciliation = {
    expectedSalesTotal,
    totalLodgement,
    totalPOS,
    overshort,
  }

  return { fuelSummaries, cashReconciliation, fuelTypes }
}

/**
 * Build meter reading rows for a single fuel type.
 *
 * Takes pre-processed data (prices resolved, closings extracted).
 * Sequential walk: accumulate at current price, emit row on price change.
 *
 * @param {string} fuelType   - e.g. 'PMS'
 * @param {Array}  ftNozzles  - nozzle configs for this fuel type
 * @param {Array}  pumpIds    - pump IDs for this fuel type
 * @param {Array}  entries    - pre-processed: [{ price, closings: { pumpId: meter } }]
 * @param {Object} openings   - initial opening per pump: { pumpId: meter }
 * @param {number} initPrice  - starting price (from prevEntry or first entry)
 */
function buildFuelMeterRows(fuelType, ftNozzles, pumpIds, entries, openings, initPrice) {
  const rows = []
  if (entries.length === 0) return { rows }

  const currentOpening = { ...openings }
  const lastClosing = { ...openings }
  let currentPrice = initPrice

  function emitRow(price) {
    let totalDispensed = 0
    const pumpDetails = ftNozzles.map(n => {
      const opening = currentOpening[n.id]
      const closing = lastClosing[n.id]
      const dispensed = closing - opening
      totalDispensed += dispensed
      return { label: `${fuelType} ${n.pump_number}`, pumpId: n.id, opening, closing, dispensed }
    })

    if (totalDispensed !== 0) {
      rows.push({ pumps: pumpDetails, dispensed: totalDispensed, price, amount: totalDispensed * price })
    }

    for (const pid of pumpIds) {
      currentOpening[pid] = lastClosing[pid]
    }
  }

  for (const entry of entries) {
    if (entry.price !== currentPrice) {
      emitRow(currentPrice)
      currentPrice = entry.price
    }

    for (const pid of pumpIds) {
      if (entry.closings[pid] != null) lastClosing[pid] = entry.closings[pid]
    }
  }

  emitRow(currentPrice)
  return { rows }
}

/**
 * Generate date strings in range.
 */
function getDateRange(startDate, endDate) {
  const pad = (n) => String(n).padStart(2, '0')
  const dates = []
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    d.setDate(d.getDate() + 1)
  }
  return dates
}
