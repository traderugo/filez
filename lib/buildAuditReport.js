import { sortEntries, getFuelTypes, getNozzlesForFuel } from './salesCalculations'
import { calculateDateRangeLodgements, sortBanks } from './lodgementCalculations'
import { calculateDateRangeConsumption } from './consumptionCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'
import { DEFAULT_PHONE } from './defaultAccounts'

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
export function buildAuditReport({ sales, lodgements, consumption, nozzles, banks, customers, receipts, tanks, startDate, endDate }) {
  if (!nozzles.length) return null

  const fuelTypes = getFuelTypes(nozzles)
  const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c.name || 'Unknown']))

  const defaultCustomers = (customers || []).filter(c => c.phone === DEFAULT_PHONE)

  const salesCash = buildSalesCashPosition({
    sales, lodgements, consumption, nozzles, banks, fuelTypes, customerMap, startDate, endDate,
  })

  const lodgementSheet = buildLodgementSheet({
    sales, lodgements, consumption, nozzles, banks, fuelTypes, startDate, endDate,
  })

  const stockPosition = buildStockPosition({
    sales, receipts: receipts || [], consumption, nozzles, tanks: tanks || [], fuelTypes, startDate, endDate,
  })

  const consumptionReport = buildConsumptionReport({
    sales, consumption, nozzles, fuelTypes, customerMap, defaultCustomers, startDate, endDate,
  })

  return { fuelTypes, salesCash, lodgementSheet, stockPosition, consumptionReport }
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

    // Resolve initial price: prefer the first range entry's price.
    // Using prevEntry's price when the fuel price changed before the range
    // causes buildFuelMeterRows to emit a spurious zero-dispensed row
    // (opening = closing = prevDay.closing, dispensed = 0).
    let initPrice = 0
    for (const p of processed) {
      if (p.price) { initPrice = p.price; break }
    }
    if (!initPrice) initPrice = Number(prevEntry?.prices?.[ft] || 0)

    // Fill in missing prices (entries without a price for this fuel inherit the last known price)
    let lastKnown = initPrice
    for (const p of processed) {
      if (p.price) { lastKnown = p.price }
      else { p.price = lastKnown }
    }

    fuelData[ft] = buildFuelMeterRows(ft, ftNozzles, pumpIds, processed, openings, initPrice)
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

  // Consumption & pour back — combined from two sources:
  //   1. nozzleReadings[].consumption / pour_back  (entered in the daily sales form)
  //   2. db.consumption entries                    (entered in the separate consumption form)
  // Both are additive; stations typically use one or the other.
  const consumptionByFuel = {}
  for (const ft of fuelTypes) {
    consumptionByFuel[ft] = { consumed: [], pourBack: [], totalConsumedQty: 0, totalConsumedAmt: 0, totalPourBackQty: 0, totalPourBackAmt: 0 }
  }

  // Source 1: nozzle readings consumption/pour_back (daily sales form)
  const nozzlesByFuelSC = {}
  for (const ft of fuelTypes) nozzlesByFuelSC[ft] = getNozzlesForFuel(nozzles, ft)

  for (const entry of rangeEntries) {
    for (const ft of fuelTypes) {
      const price = Number(entry.prices?.[ft] || 0) || getPriceForDate(ft, entry.entryDate)
      let consumed = 0, pourBack = 0
      for (const n of nozzlesByFuelSC[ft]) {
        const r = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
        if (!r) continue
        consumed += Number(r.consumption || 0)
        pourBack += Number(r.pour_back || 0)
      }
      if (consumed) {
        const amt = consumed * price
        consumptionByFuel[ft].consumed.push({ name: 'Station', qty: consumed, price, amt, customerId: null })
        consumptionByFuel[ft].totalConsumedQty += consumed
        consumptionByFuel[ft].totalConsumedAmt += amt
      }
      if (pourBack) {
        const amt = pourBack * price
        consumptionByFuel[ft].pourBack.push({ name: 'Pour Back', qty: pourBack, price, amt, customerId: null })
        consumptionByFuel[ft].totalPourBackQty += pourBack
        consumptionByFuel[ft].totalPourBackAmt += amt
      }
    }
  }

  // Source 2: dedicated consumption entries (consumption form, per-customer)
  const consumptionResult = calculateDateRangeConsumption(consumption, startDate, endDate)
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

    rows.push({ pumps: pumpDetails, dispensed: totalDispensed, price, amount: totalDispensed * price })

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
 * Build Stock Position sub-report.
 * Per-day per-fuel: opening, supply, qtySold (tank-based), closing, OV/SH, actual OV/SH.
 */
function buildStockPosition({ sales, receipts, consumption, nozzles, tanks, fuelTypes, startDate, endDate }) {
  const sorted = sortEntries(sales)
  const dateStrings = getDateRange(startDate, endDate)

  let prevEntry = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].entryDate < startDate) { prevEntry = sorted[i]; break }
  }
  const rangeEntries = sorted.filter(e => e.entryDate >= startDate && e.entryDate <= endDate)

  const entriesByDate = {}
  for (const e of rangeEntries) {
    const d = e.entryDate || ''
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  // Receipts & consumption by date
  const receiptResult = calculateDateRangeReceipts(receipts, tanks, startDate, endDate)
  const receiptByDate = {}
  for (const rd of receiptResult.dates) receiptByDate[rd.date] = rd

  const consumptionResult = calculateDateRangeConsumption(consumption, startDate, endDate)
  const consumptionByDate = {}
  for (const cd of consumptionResult.dates) consumptionByDate[cd.date] = cd

  // Nozzle opening meters
  const prevClosing = {}
  for (const n of nozzles) {
    if (prevEntry) {
      const r = (prevEntry.nozzleReadings || []).find(r => r.pump_id === n.id)
      if (r) { prevClosing[n.id] = Number(r.closing_meter || 0); continue }
    }
    prevClosing[n.id] = Number(n.initial_reading || 0)
  }

  const nozzlesByFuel = {}
  const tanksByFuel = {}
  for (const ft of fuelTypes) {
    nozzlesByFuel[ft] = nozzles.filter(n => n.fuel_type === ft)
    tanksByFuel[ft] = tanks.filter(t => t.fuel_type === ft).sort((a, b) => Number(a.tank_number) - Number(b.tank_number))
  }

  // Tank COB readings before range (same pattern as daily report)
  let prevCobTankReadings = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].entryDate < startDate) {
      prevCobTankReadings = sorted[i].tankReadings || []
      break
    }
  }

  const fuelRows = {}
  for (const ft of fuelTypes) fuelRows[ft] = []

  for (const date of dateStrings) {
    const dayEntries = entriesByDate[date] || []
    const dayReceipt = receiptByDate[date] || { supplyByTankId: {} }
    const dayConsumption = consumptionByDate[date] || { byFuelType: {} }

    // COB entry for tank readings
    const cobEntry = [...dayEntries].reverse().find(e => e.closeOfBusiness || e.close_of_business)
    const tankEntry = cobEntry || dayEntries[dayEntries.length - 1] || null
    const cobTankReadings = tankEntry ? (tankEntry.tankReadings || []) : null

    // Nozzle dispensed per fuel type (for OV/SH calculation)
    const dispensedByFuel = {}
    for (const ft of fuelTypes) dispensedByFuel[ft] = 0

    for (const entry of dayEntries) {
      const readingMap = {}
      for (const r of (entry.nozzleReadings || [])) readingMap[r.pump_id] = r

      for (const ft of fuelTypes) {
        for (const n of nozzlesByFuel[ft]) {
          const r = readingMap[n.id]
          if (!r) continue
          const closing = Number(r.closing_meter || 0)
          const opening = prevClosing[n.id] || 0
          dispensedByFuel[ft] += (closing - opening)
          prevClosing[n.id] = closing
        }
      }
    }

    // Per fuel type stock position
    for (const ft of fuelTypes) {
      const ftTanks = tanksByFuel[ft]
      let totalOpening = 0, totalClosing = 0, totalSupply = 0

      for (const t of ftTanks) {
        const prevR = prevCobTankReadings ? prevCobTankReadings.find(r => r.tank_id === t.id) : null
        const opening = prevR ? Number(prevR.closing_stock || 0) : Number(t.opening_stock || 0)
        const cobR = cobTankReadings ? cobTankReadings.find(r => r.tank_id === t.id) : null
        const closing = cobR ? Number(cobR.closing_stock || 0) : opening
        const supply = dayReceipt.supplyByTankId[t.id] || 0

        totalOpening += opening
        totalClosing += closing
        totalSupply += supply
      }

      const qtySold = totalOpening + totalSupply - totalClosing
      const dispensed = dispensedByFuel[ft]
      const ovsh = (totalClosing - totalOpening) - totalSupply + dispensed
      const pourBack = dayConsumption.byFuelType?.[ft]?.pourBack || 0
      const actualOvsh = ovsh - pourBack

      fuelRows[ft].push({
        date, opening: totalOpening, supply: totalSupply, qtySold,
        closing: totalClosing, dispensed, ovsh, actualOvsh, variance: null,
        hasData: dayEntries.length > 0,
      })
    }

    if (cobTankReadings) prevCobTankReadings = cobTankReadings
  }

  // Truck driver data: receipts grouped by fuel type
  const tankFuelMap = {}
  for (const t of tanks) tankFuelMap[t.id] = t.fuel_type

  const rangeReceipts = (receipts || []).filter(r => {
    const d = r.entryDate || ''
    return d >= startDate && d <= endDate
  })

  const receiptsByFuel = {}
  for (const ft of fuelTypes) receiptsByFuel[ft] = []
  for (const r of rangeReceipts) {
    const ft = tankFuelMap[r.tankId]
    if (ft && receiptsByFuel[ft]) receiptsByFuel[ft].push(r)
  }

  // Period totals per fuel type
  const result = {}
  for (const ft of fuelTypes) {
    const rows = fuelRows[ft]
    const ftReceipts = receiptsByFuel[ft] || []
    const expectedLitres = ftReceipts.reduce((s, r) =>
      s + Number(r.firstCompartment || 0) + Number(r.secondCompartment || 0) + Number(r.thirdCompartment || 0), 0)
    const actualLitresReceived = ftReceipts.reduce((s, r) => s + Number(r.actualVolume || 0), 0)

    result[ft] = {
      rows,
      totals: {
        opening: rows.length > 0 ? rows[0].opening : 0,
        supply: rows.reduce((s, r) => s + r.supply, 0),
        qtySold: rows.reduce((s, r) => s + r.qtySold, 0),
        closing: rows.length > 0 ? rows[rows.length - 1].closing : 0,
        dispensed: rows.reduce((s, r) => s + r.dispensed, 0),
        ovsh: rows.reduce((s, r) => s + r.ovsh, 0),
        actualOvsh: rows.reduce((s, r) => s + r.actualOvsh, 0),
        variance: null,
        expectedLitres,
        actualLitresReceived,
        truckDriverOvsh: actualLitresReceived - expectedLitres,
      },
    }
  }
  return result
}

/**
 * Build Lodgement Sheet sub-report.
 * Per-day breakdown: Total Sales, POS by bank, Expected deposit, Actual deposit, cumulative OV/SH.
 */
function buildLodgementSheet({ sales, lodgements, consumption, nozzles, banks, fuelTypes, startDate, endDate }) {
  const sorted = sortEntries(sales)
  const dateStrings = getDateRange(startDate, endDate)

  let prevEntry = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].entryDate < startDate) { prevEntry = sorted[i]; break }
  }
  const rangeEntries = sorted.filter(e => e.entryDate >= startDate && e.entryDate <= endDate)

  const entriesByDate = {}
  for (const e of rangeEntries) {
    const d = e.entryDate || ''
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  // Opening meters per nozzle
  const prevClosing = {}
  for (const n of nozzles) {
    if (prevEntry) {
      const r = (prevEntry.nozzleReadings || []).find(r => r.pump_id === n.id)
      if (r) { prevClosing[n.id] = Number(r.closing_meter || 0); continue }
    }
    prevClosing[n.id] = Number(n.initial_reading || 0)
  }

  const nozzlesByFuel = {}
  for (const ft of fuelTypes) nozzlesByFuel[ft] = nozzles.filter(n => n.fuel_type === ft)

  let lastPrices = prevEntry?.prices ? { ...prevEntry.prices } : {}

  // Exclude lube-deposit entries
  const filteredLodgements = lodgements.filter(l => l.lodgementType !== 'lube-deposit')
  const lodgementResult = calculateDateRangeLodgements(filteredLodgements, banks, startDate, endDate)
  const lodgementByDate = {}
  for (const ld of lodgementResult.dates) lodgementByDate[ld.date] = ld

  // Consumption & pour-back by date (actual consumption entries, not nozzle readings)
  const consumptionResult = calculateDateRangeConsumption(consumption || [], startDate, endDate)
  const consumptionByDate = {}
  for (const cd of consumptionResult.dates) consumptionByDate[cd.date] = cd

  // POS first, then bank_deposit, cash, other
  const orderedBanks = sortBanks(banks)

  let cumulativeOvSh = 0
  const rows = dateStrings.map((date, idx) => {
    const dayEntries = entriesByDate[date] || []
    const dayLodgement = lodgementByDate[date] || {
      bankRows: [], totalPOS: 0, totalDeposits: 0, totalCash: 0, totalOther: 0, totalAll: 0, hasEntry: false,
    }
    const dayConsumption = consumptionByDate[date] || { byFuelType: {} }

    // Per-day total sales from nozzle readings
    let totalSales = 0
    for (const entry of dayEntries) {
      const prices = entry.prices || lastPrices
      if (entry.prices) {
        for (const ft of fuelTypes) {
          if (entry.prices[ft]) lastPrices[ft] = entry.prices[ft]
        }
      }

      const readingMap = {}
      for (const r of (entry.nozzleReadings || [])) readingMap[r.pump_id] = r

      for (const ft of fuelTypes) {
        const price = Number(prices[ft] || 0)
        let ftDispensed = 0, ftConsumed = 0, ftPourBack = 0

        for (const n of nozzlesByFuel[ft]) {
          const r = readingMap[n.id]
          if (!r) continue
          const closing = Number(r.closing_meter || 0)
          const opening = prevClosing[n.id] || 0
          ftDispensed += (closing - opening)
          ftConsumed += Number(r.consumption || 0)
          ftPourBack += Number(r.pour_back || 0)
          prevClosing[n.id] = closing
        }

        totalSales += (ftDispensed - ftConsumed - ftPourBack) * price
      }
    }

    // ALSO deduct any consumption entered via the separate consumption form for this day
    for (const ft of fuelTypes) {
      const price = Number(lastPrices[ft] || 0)
      const consumed = dayConsumption.byFuelType?.[ft]?.consumed || 0
      const pourBack = dayConsumption.byFuelType?.[ft]?.pourBack || 0
      totalSales -= (consumed + pourBack) * price
    }

    // Per-bank amounts
    const bankAmounts = {}
    for (const br of dayLodgement.bankRows) bankAmounts[br.bankId] = br.deposited

    const totalPOS = dayLodgement.totalPOS
    const actualDeposit = dayLodgement.totalDeposits
    const expected = totalSales - totalPOS - dayLodgement.totalCash - dayLodgement.totalOther

    cumulativeOvSh += (expected - actualDeposit)

    return {
      sheet: idx + 1, date, totalSales, expected, bankAmounts,
      totalPOS, actual: actualDeposit, ovsh: cumulativeOvSh,
      hasData: dayEntries.length > 0 || dayLodgement.hasEntry,
    }
  })

  // Period totals
  const totals = { totalSales: 0, expected: 0, totalPOS: 0, actual: 0, bankTotals: {} }
  for (const bank of orderedBanks) totals.bankTotals[bank.id] = 0
  for (const row of rows) {
    totals.totalSales += row.totalSales
    totals.expected += row.expected
    totals.totalPOS += row.totalPOS
    totals.actual += row.actual
    for (const bank of orderedBanks) {
      totals.bankTotals[bank.id] += (row.bankAmounts[bank.id] || 0)
    }
  }
  totals.ovsh = totals.expected - totals.actual

  return { rows, banks: orderedBanks, totals }
}

/**
 * Build Consumption & Pour Back sub-report.
 * Per fuel type: per-date rows with rate, quantity per customer, pour back.
 */
function buildConsumptionReport({ sales, consumption, nozzles, fuelTypes, customerMap, defaultCustomers, startDate, endDate }) {
  const sorted = sortEntries(sales)
  const dateStrings = getDateRange(startDate, endDate)

  // Filter range entries for prices
  let prevEntry = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].entryDate < startDate) { prevEntry = sorted[i]; break }
  }
  const rangeEntries = sorted.filter(e => e.entryDate >= startDate && e.entryDate <= endDate)

  // Price lookup by date
  const priceByDate = {}
  for (const e of rangeEntries) {
    if (!e.prices) continue
    priceByDate[e.entryDate] = priceByDate[e.entryDate] || {}
    for (const ft of fuelTypes) {
      const p = Number(e.prices[ft] || 0)
      if (p) priceByDate[e.entryDate][ft] = p
    }
  }

  // Carry forward from prevEntry
  const lastKnownPrice = {}
  if (prevEntry?.prices) {
    for (const ft of fuelTypes) {
      if (prevEntry.prices[ft]) lastKnownPrice[ft] = Number(prevEntry.prices[ft])
    }
  }

  function getPriceForDate(ft, date) {
    if (priceByDate[date]?.[ft]) return priceByDate[date][ft]
    for (let i = dateStrings.indexOf(date) - 1; i >= 0; i--) {
      if (priceByDate[dateStrings[i]]?.[ft]) return priceByDate[dateStrings[i]][ft]
    }
    for (let i = dateStrings.indexOf(date) + 1; i < dateStrings.length; i++) {
      if (priceByDate[dateStrings[i]]?.[ft]) return priceByDate[dateStrings[i]][ft]
    }
    return lastKnownPrice[ft] || 0
  }

  // Group consumption entries by date and fuel type
  const rangeConsumption = (consumption || []).filter(e => {
    const d = e.entryDate || ''
    return d >= startDate && d <= endDate
  })

  const byDateFuel = {}
  for (const e of rangeConsumption) {
    const key = `${e.entryDate}|${e.fuelType}`
    if (!byDateFuel[key]) byDateFuel[key] = []
    byDateFuel[key].push(e)
  }

  // Per fuel type: find unique customers (non-pour-back only)
  const result = {}
  for (const ft of fuelTypes) {
    const ftEntries = rangeConsumption.filter(e => e.fuelType === ft)
    const customerIds = new Set()
    for (const e of ftEntries) {
      if (!e.isPourBack) customerIds.add(e.customerId)
    }
    // Always include default accounts even if they have no entries
    for (const dc of defaultCustomers) {
      customerIds.add(dc.id)
    }
    const customers = [...customerIds].map(id => ({ id, name: customerMap[id] || 'Unknown' }))
    customers.sort((a, b) => a.name.localeCompare(b.name))

    const rows = dateStrings.map(date => {
      const dayEntries = byDateFuel[`${date}|${ft}`] || []
      const rate = getPriceForDate(ft, date)

      const customerQtys = {}
      let pourBack = 0
      for (const e of dayEntries) {
        const qty = Number(e.quantity || 0)
        if (e.isPourBack) {
          pourBack += qty
        } else {
          customerQtys[e.customerId] = (customerQtys[e.customerId] || 0) + qty
        }
      }

      return { date, rate, customerQtys, pourBack, hasData: dayEntries.length > 0 }
    })

    // Period totals
    const totals = { customerTotals: {}, pourBack: 0 }
    for (const c of customers) totals.customerTotals[c.id] = 0
    for (const row of rows) {
      for (const c of customers) {
        totals.customerTotals[c.id] += (row.customerQtys[c.id] || 0)
      }
      totals.pourBack += row.pourBack
    }

    result[ft] = { customers, rows, totals }
  }

  return result
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
