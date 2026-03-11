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

  // Each entry keeps its own row with its actual price — no aggregation

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
 * Logic:
 * - Walk through each date in order.
 * - For each date, get the entries for that date.
 * - If multiple entries: each entry produces a row (price change boundary).
 * - If single entry: it extends the current accumulation period.
 *   We emit a row when the price changes or at the end of the range.
 */
function buildFuelMeterRows(fuelType, nozzles, allSorted, prevEntry, dateStrings, entriesByDate) {
  const ftNozzles = getNozzlesForFuel(nozzles, fuelType)
  const rows = []

  // Get per-pump opening from prevEntry or initial_reading
  function getPumpOpening(pumpId) {
    if (prevEntry) {
      const r = (prevEntry.nozzleReadings || []).find(r => r.pump_id === pumpId)
      if (r) return Number(r.closing_meter || 0)
    }
    const n = ftNozzles.find(n => n.id === pumpId)
    return n ? Number(n.initial_reading || 0) : 0
  }

  // Track current opening per pump (start of current row)
  const currentOpening = {}
  for (const n of ftNozzles) {
    currentOpening[n.id] = getPumpOpening(n.id)
  }

  // Track the "last closing" (end of last processed entry)
  const lastClosing = { ...currentOpening }
  let currentPrice = 0

  // Find the initial price from prevEntry or first entry in range
  if (prevEntry && prevEntry.prices) {
    currentPrice = Number(prevEntry.prices[fuelType] || 0)
  }

  // We need to find the first price in the range if prevEntry has no price
  if (!currentPrice) {
    for (const date of dateStrings) {
      const dayEntries = entriesByDate[date] || []
      for (const e of dayEntries) {
        if (e.prices && e.prices[fuelType]) {
          currentPrice = Number(e.prices[fuelType])
          break
        }
      }
      if (currentPrice) break
    }
  }

  let hasOpenRow = false // whether we have an uncommitted row accumulating

  function emitRow(price) {
    let totalDispensed = 0
    const pumpDetails = ftNozzles.map(n => {
      const opening = currentOpening[n.id]
      const closing = lastClosing[n.id]
      const dispensed = closing - opening
      totalDispensed += dispensed
      return { label: `${fuelType} ${n.pump_number}`, pumpId: n.id, opening, closing, dispensed }
    })

    // Skip rows with zero dispensed (no actual sales in this period)
    if (totalDispensed !== 0) {
      const amount = totalDispensed * price
      rows.push({ pumps: pumpDetails, dispensed: totalDispensed, price, amount })
    }

    // Reset opening to current closing
    for (const n of ftNozzles) {
      currentOpening[n.id] = lastClosing[n.id]
    }
    hasOpenRow = false
  }

  for (const date of dateStrings) {
    const dayEntries = entriesByDate[date] || []
    if (dayEntries.length === 0) continue

    if (dayEntries.length === 1) {
      const entry = dayEntries[0]
      const entryPrice = Number(entry.prices?.[fuelType] || 0) || currentPrice

      // If price changed, emit the previous row first
      if (hasOpenRow && entryPrice !== currentPrice) {
        emitRow(currentPrice)
      }

      // Update last closing from this entry
      for (const n of ftNozzles) {
        const r = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
        if (r) lastClosing[n.id] = Number(r.closing_meter || 0)
      }
      currentPrice = entryPrice
      hasOpenRow = true
    } else {
      // Multiple entries in a day — each one gets its own row
      for (let i = 0; i < dayEntries.length; i++) {
        const entry = dayEntries[i]
        const entryPrice = Number(entry.prices?.[fuelType] || 0) || currentPrice

        // If this is the first entry of the day and we have an open row,
        // the first entry's closing becomes the closing for the previous row
        if (i === 0 && hasOpenRow) {
          // Update closing from this entry
          for (const n of ftNozzles) {
            const r = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
            if (r) lastClosing[n.id] = Number(r.closing_meter || 0)
          }
          // Emit the accumulated row with the OLD price
          emitRow(currentPrice)
          currentPrice = entryPrice
        } else if (i === 0) {
          // No open row — this entry's closing ends the first period (old price)
          for (const n of ftNozzles) {
            const r = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
            if (r) lastClosing[n.id] = Number(r.closing_meter || 0)
          }
          // Use the carried-forward price (the price before the change)
          emitRow(currentPrice || entryPrice)
          currentPrice = entryPrice
        } else {
          // Subsequent entries within the same day — each is its own row
          for (const n of ftNozzles) {
            const r = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
            if (r) lastClosing[n.id] = Number(r.closing_meter || 0)
          }
          // If this is not the last entry of the day, emit immediately
          if (i < dayEntries.length - 1) {
            emitRow(entryPrice)
          } else {
            // Last entry — keep it open for the next day to accumulate
            currentPrice = entryPrice
            hasOpenRow = true
          }
        }
      }
    }
  }

  // Emit any remaining open row at the end of the range
  if (hasOpenRow) {
    emitRow(currentPrice)
  }

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
