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

  // Group range entries by date
  const entriesByDate = {}
  for (const e of rangeEntries) {
    if (!entriesByDate[e.entryDate]) entriesByDate[e.entryDate] = []
    entriesByDate[e.entryDate].push(e)
  }

  // Generate date strings in range
  const dateStrings = getDateRange(startDate, endDate)

  // Build meter reading rows per fuel type.
  // Each "row" captures a price period: opening, closing, dispensed, price, amount.
  // Days with multiple entries produce multiple rows (price changes).
  // Days with single entries extend the current period — we only emit a row
  // when the next entry has a different price OR at the very end.
  const fuelData = {}
  for (const ft of fuelTypes) {
    fuelData[ft] = buildFuelMeterRows(ft, nozzles, sorted, prevEntry, dateStrings, entriesByDate)
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
 * Build meter reading rows for a single fuel type across the date range.
 *
 * Simple sequential walk through ALL entries (ignoring dates).
 * Accumulate readings at the current price. When the price changes,
 * emit a row for the accumulated period and start a new one.
 * At the end, emit whatever is left.
 */
function buildFuelMeterRows(fuelType, nozzles, allSorted, prevEntry, dateStrings, entriesByDate) {
  const ftNozzles = getNozzlesForFuel(nozzles, fuelType)
  const rows = []

  // Flatten all entries in range into one sequential list (already sorted)
  const rangeEntries = []
  for (const date of dateStrings) {
    const dayEntries = entriesByDate[date] || []
    rangeEntries.push(...dayEntries)
  }

  if (rangeEntries.length === 0) return { rows }

  // Per-pump opening from prevEntry or initial_reading
  function getPumpOpening(pumpId) {
    if (prevEntry) {
      const r = (prevEntry.nozzleReadings || []).find(r => r.pump_id === pumpId)
      if (r) return Number(r.closing_meter || 0)
    }
    const n = ftNozzles.find(n => n.id === pumpId)
    return n ? Number(n.initial_reading || 0) : 0
  }

  const currentOpening = {}
  const lastClosing = {}
  for (const n of ftNozzles) {
    currentOpening[n.id] = getPumpOpening(n.id)
    lastClosing[n.id] = getPumpOpening(n.id)
  }

  // Initial price from prevEntry or first entry in range
  let currentPrice = 0
  if (prevEntry?.prices) {
    currentPrice = Number(prevEntry.prices[fuelType] || 0)
  }
  if (!currentPrice) {
    for (const e of rangeEntries) {
      if (e.prices?.[fuelType]) {
        currentPrice = Number(e.prices[fuelType])
        break
      }
    }
  }

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

    // Next row's opening = this row's closing
    for (const n of ftNozzles) {
      currentOpening[n.id] = lastClosing[n.id]
    }
  }

  // Sequential check — emit a row whenever price changes
  for (const entry of rangeEntries) {
    const entryPrice = Number(entry.prices?.[fuelType] || 0) || currentPrice

    // Price changed — close the current period at old price
    if (entryPrice !== currentPrice) {
      emitRow(currentPrice)
      currentPrice = entryPrice
    }

    // Update closing readings from this entry
    for (const n of ftNozzles) {
      const r = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
      if (r) lastClosing[n.id] = Number(r.closing_meter || 0)
    }
  }

  // Emit final accumulated row
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
