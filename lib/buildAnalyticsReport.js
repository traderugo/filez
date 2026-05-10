import {
  sortEntries,
  getFuelTypes,
  getTanksForFuel,
  calculateDateRangeNozzles,
  computeDayFuelTotals,
} from './salesCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'

/**
 * Build a single-station analytics report covering a date range.
 *
 * Output is shaped for direct binding to recharts. Variance uses a single
 * convention across fuels: positive = within ±1.25% tolerance, negative = beyond.
 *
 * @returns {{
 *   fuelTypes: string[],
 *   summary: Object,
 *   fuelMix: { [ft]: number },
 *   series: Array,
 *   stockSeries: Array,
 *   varianceSeries: Array,
 *   revenueSeries: Array,
 *   ovshSeries: Array,
 * } | null}
 */
export function buildAnalyticsReport({ sales, receipts, lodgements, nozzles, tanks, banks, startDate, endDate }) {
  if (!nozzles?.length) return null

  const fuelTypes = getFuelTypes(nozzles)
  const allSorted = sortEntries(sales || [])
  const range = calculateDateRangeNozzles(allSorted, nozzles, startDate, endDate, tanks || [])
  const receiptResult = calculateDateRangeReceipts(receipts || [], tanks || [], startDate, endDate)

  const filteredLodgements = (lodgements || []).filter(l => l.lodgementType !== 'lube-deposit')
  const lodgementResult = calculateDateRangeLodgements(filteredLodgements, banks || [], startDate, endDate)

  const entriesByDate = {}
  for (const e of allSorted) {
    if (!entriesByDate[e.entryDate]) entriesByDate[e.entryDate] = []
    entriesByDate[e.entryDate].push(e)
  }

  const receiptByDate = {}
  for (const rd of receiptResult.dates) receiptByDate[rd.date] = rd

  const lodgementByDate = {}
  for (const ld of lodgementResult.dates) lodgementByDate[ld.date] = ld

  const tankFuelMap = {}
  for (const t of tanks || []) tankFuelMap[t.id] = t.fuel_type

  // Seed prev COB tank readings from before startDate
  let prevCobTankReadings = null
  for (let i = allSorted.length - 1; i >= 0; i--) {
    const e = allSorted[i]
    if (e.entryDate < startDate && (e.closeOfBusiness || e.close_of_business)) {
      prevCobTankReadings = e.tankReadings || []
      break
    }
  }
  if (!prevCobTankReadings) {
    for (let i = allSorted.length - 1; i >= 0; i--) {
      const e = allSorted[i]
      if (e.entryDate < startDate) {
        prevCobTankReadings = e.tankReadings || []
        break
      }
    }
  }

  // Tank closing stock carry-forward (per tank)
  const lastClosingByTank = {}
  for (const t of tanks || []) {
    const prevR = prevCobTankReadings ? prevCobTankReadings.find(r => r.tank_id === t.id) : null
    lastClosingByTank[t.id] = prevR ? Number(prevR.closing_stock || 0) : Number(t.opening_stock || 0)
  }

  let cumulativeOvsh = 0
  let totalSales = 0
  let totalVolume = 0
  let totalLodged = 0
  let totalExpected = 0
  const fuelMix = {}
  for (const ft of fuelTypes) fuelMix[ft] = 0

  const series = range.dates.map(({ date, entries: helperEntries, hasEntry }) => {
    const dayEntries = entriesByDate[date] || []
    const { dayFuelTotals } = computeDayFuelTotals({
      helperEntries, dateEntries: dayEntries, fuelTypes, allSorted, date,
    })

    // Revenue & volume per fuel
    const revenueByFuel = {}
    const volumeByFuel = {}
    let revenueTotal = 0
    let volumeTotal = 0
    for (const ft of fuelTypes) {
      const t = dayFuelTotals[ft]
      revenueByFuel[ft] = t.amount
      volumeByFuel[ft] = t.dispensed
      revenueTotal += t.amount
      volumeTotal += t.dispensed
      fuelMix[ft] += t.amount
    }

    // Tank closing stock for the day (COB if available; otherwise carry forward)
    const cobEntry = [...dayEntries].reverse().find(e => e.closeOfBusiness || e.close_of_business)
    const tankEntry = cobEntry || dayEntries[dayEntries.length - 1] || null
    const cobTankReadings = tankEntry ? (tankEntry.tankReadings || []) : null

    const stockByFuel = {}
    const openingByFuel = {}
    const supplyByFuel = {}
    const deliveryByFuel = {}
    for (const ft of fuelTypes) { stockByFuel[ft] = 0; openingByFuel[ft] = 0; supplyByFuel[ft] = 0; deliveryByFuel[ft] = false }

    for (const t of (tanks || [])) {
      const ft = t.fuel_type
      if (!fuelTypes.includes(ft)) continue
      const opening = lastClosingByTank[t.id]
      const cobR = cobTankReadings ? cobTankReadings.find(r => r.tank_id === t.id) : null
      const closing = cobR ? Number(cobR.closing_stock || 0) : opening
      const dayReceipt = receiptByDate[date] || { supplyByTankId: {} }
      const supply = dayReceipt.supplyByTankId[t.id] || 0

      openingByFuel[ft] += opening
      stockByFuel[ft] += closing
      supplyByFuel[ft] += supply
      if (supply > 0) deliveryByFuel[ft] = true

      lastClosingByTank[t.id] = closing
    }

    // Driver shortage per fuel from receipts (delivery-grouped)
    const dayReceiptList = receiptByDate[date]?.receipts || []
    const expByFuel = {}, actByFuel = {}
    for (const ft of fuelTypes) { expByFuel[ft] = 0; actByFuel[ft] = 0 }

    const deliveryMap = {}
    for (const r of dayReceiptList) {
      const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
      const key = parts.some(Boolean) ? parts.join('|') : r.id
      if (!deliveryMap[key]) deliveryMap[key] = { first: r, records: [] }
      deliveryMap[key].records.push(r)
    }
    for (const { first, records } of Object.values(deliveryMap)) {
      const expected = Number(first.highVol1 || 0) + Number(first.highVol2 || 0) + Number(first.highVol3 || 0)
      const byFuel = {}
      for (const r of records) {
        const ft = tankFuelMap[r.tankId]
        if (!ft) continue
        if (!byFuel[ft]) byFuel[ft] = { actual: 0 }
        byFuel[ft].actual += Number(r.actualVolume || 0)
      }
      const fts = Object.keys(byFuel)
      if (fts.length === 1) {
        expByFuel[fts[0]] += expected
        actByFuel[fts[0]] += byFuel[fts[0]].actual
      } else if (fts.length > 1) {
        const totalActual = fts.reduce((s, ft) => s + byFuel[ft].actual, 0)
        for (const ft of fts) {
          const share = totalActual > 0 ? Math.round(expected * byFuel[ft].actual / totalActual) : 0
          expByFuel[ft] += share
          actByFuel[ft] += byFuel[ft].actual
        }
      }
    }

    // Variance per fuel — single convention: positive = within tolerance, negative = beyond
    const varianceByFuel = {}
    for (const ft of fuelTypes) {
      const dispensed = volumeByFuel[ft] || 0
      const driverShortage = (expByFuel[ft] || 0) - (actByFuel[ft] || 0)
      const tankOvsh = (stockByFuel[ft] - openingByFuel[ft]) - supplyByFuel[ft] + dispensed
      const pourBack = dayFuelTotals[ft].pourBack || 0
      const actualOvsh = tankOvsh - pourBack
      varianceByFuel[ft] = (dispensed * 0.0125) - driverShortage - actualOvsh
    }

    // Cash OV/SH for the day: lodged − expected (negative = shortage)
    const ld = lodgementByDate[date] || {}
    const lodged = (ld.totalPOS || 0) + (ld.totalTransfer || 0) + (ld.totalDeposits || 0) + (ld.totalCash || 0) + (ld.totalOther || 0)
    const expected = revenueTotal
    const dailyCashOvsh = lodged - expected
    cumulativeOvsh += dailyCashOvsh

    totalSales += revenueTotal
    totalVolume += volumeTotal
    totalLodged += lodged
    totalExpected += expected

    return {
      date,
      hasEntry,
      revenueByFuel,
      revenueTotal,
      volumeByFuel,
      volumeTotal,
      stockByFuel,
      deliveryByFuel,
      varianceByFuel,
      dailyCashOvsh,
      cumulativeOvsh,
      expected,
      lodged,
    }
  })

  // Recharts-friendly flat series
  const stockSeries = series.map(d => {
    const row = { date: d.date }
    for (const ft of fuelTypes) {
      row[ft] = d.stockByFuel[ft]
      row[`${ft}_delivery`] = d.deliveryByFuel[ft] ? d.stockByFuel[ft] : null
    }
    return row
  })

  const varianceSeries = series.map(d => {
    const row = { date: d.date }
    for (const ft of fuelTypes) row[ft] = d.varianceByFuel[ft]
    return row
  })

  const revenueSeries = series.map(d => {
    const row = { date: d.date }
    for (const ft of fuelTypes) row[ft] = d.revenueByFuel[ft]
    return row
  })

  const ovshSeries = series.map(d => ({
    date: d.date,
    daily: d.dailyCashOvsh,
    cumulative: d.cumulativeOvsh,
  }))

  // Summary KPIs
  const dayCount = series.length || 1
  const lastDay = series[series.length - 1]
  const currentStockByFuel = lastDay ? { ...lastDay.stockByFuel } : {}
  const pendingLodgement = totalExpected - totalLodged
  const netOvsh = lastDay?.cumulativeOvsh || 0

  return {
    fuelTypes,
    summary: {
      totalSales,
      totalVolume,
      avgDailyVolume: totalVolume / dayCount,
      avgDailyRevenue: totalSales / dayCount,
      netOvsh,
      currentStockByFuel,
      pendingLodgement,
      dayCount,
    },
    fuelMix,
    series,
    stockSeries,
    varianceSeries,
    revenueSeries,
    ovshSeries,
  }
}
