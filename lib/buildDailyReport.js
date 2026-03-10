import { calculateDateRangeNozzles } from './salesCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'

/**
 * Build the complete daily sales report from raw IndexedDB data + config.
 *
 * Pure function — no side effects, no state, no DOM.
 * All inputs expected in camelCase (as stored by normalizeEntry / form saves).
 *
 * @param {Object} params
 * @param {Array}  params.sales       - All dailySales entries for the org
 * @param {Array}  params.receipts    - All productReceipts entries for the org
 * @param {Array}  params.lodgements  - All lodgement entries for the org
 * @param {Array}  params.consumption - All consumption entries for the org
 * @param {Array}  params.nozzles     - Nozzle config objects
 * @param {Array}  params.tanks       - Tank config objects
 * @param {Array}  params.banks       - Bank config objects
 * @param {string} params.startDate   - YYYY-MM-DD
 * @param {string} params.endDate     - YYYY-MM-DD
 * @returns {{ dateReports: Array, fuelTypes: Array }}
 */
export function buildDailyReport({ sales, receipts, lodgements, consumption, nozzles, tanks, banks, startDate, endDate }) {
  if (!nozzles.length) return null

  // ── 1. Nozzle + tank calculations ──
  const rangeResult = calculateDateRangeNozzles(sales, nozzles, startDate, endDate, tanks)
  const { fuelTypes } = rangeResult

  // ── 2. Lodgement calculations ──
  const lodgementResult = calculateDateRangeLodgements(lodgements, banks, startDate, endDate)
  const lodgementByDate = {}
  for (const ld of lodgementResult.dates) {
    lodgementByDate[ld.date] = ld
  }

  // ── 3. Receipt calculations ──
  const receiptResult = calculateDateRangeReceipts(receipts, tanks, startDate, endDate)
  const receiptByDate = {}
  for (const rd of receiptResult.dates) {
    receiptByDate[rd.date] = rd
  }

  // ── 4. Sort sales for per-date matching ──
  const sorted = [...sales].sort((a, b) =>
    (a.entryDate || '').localeCompare(b.entryDate || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )

  // ── 5. Nozzle→tank mapping from config ──
  const nozzleTankMap = {}
  for (const nc of nozzles) {
    if (nc.tank_id) nozzleTankMap[nc.id] = nc.tank_id
  }

  // ── 6. Build per-date reports ──
  const dateReports = rangeResult.dates.map(({ date, entries: helperEntries, hasEntry, entryCount }) => {
    const dateEntries = sorted.filter(e => e.entryDate === date)

    const entryGroups = []
    const dayFuelTotals = {}
    const dispensedByTankId = {}
    for (const ft of fuelTypes) {
      dayFuelTotals[ft] = { dispensed: 0, consumed: 0, actual: 0, price: 0, amount: 0, pourBack: 0 }
    }

    // Carry forward prices for no-entry days
    let prevPrices = {}
    if (dateEntries.length === 0) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].entryDate < date) { prevPrices = sorted[i].prices || {}; break }
      }
    }

    for (let i = 0; i < helperEntries.length; i++) {
      const helperEntry = helperEntries[i]
      const currentEntry = dateEntries[i] || {}
      const nozzleRows = []
      const entryFuelTotals = {}

      for (const ft of fuelTypes) {
        const fg = helperEntry.fuelGroups[ft]
        const price = Number(currentEntry.prices?.[ft]) || Number(prevPrices[ft]) || 0

        let ftConsumed = 0
        let ftPourBack = 0
        const rows = fg.nozzles.map(n => {
          const currentR = (currentEntry.nozzleReadings || []).find(r => r.pump_id === n.pumpId)
          const consumption = currentR ? Number(currentR.consumption || 0) : 0
          const pourBack = currentR ? Number(currentR.pour_back || 0) : 0
          const actual = n.dispensed - consumption - pourBack
          ftConsumed += consumption
          ftPourBack += pourBack
          const tid = nozzleTankMap[n.pumpId]
          if (tid) dispensedByTankId[tid] = (dispensedByTankId[tid] || 0) + n.dispensed
          return { ...n, consumption, pourBack, actual }
        })

        const ftActual = fg.totals.dispensed - ftConsumed - ftPourBack
        const ftAmount = ftActual * price

        entryFuelTotals[ft] = {
          dispensed: fg.totals.dispensed, consumed: ftConsumed, actual: ftActual,
          price, amount: ftAmount, pourBack: ftPourBack,
        }

        dayFuelTotals[ft].dispensed += fg.totals.dispensed
        dayFuelTotals[ft].consumed += ftConsumed
        dayFuelTotals[ft].actual += ftActual
        dayFuelTotals[ft].pourBack += ftPourBack
        dayFuelTotals[ft].price = price
        dayFuelTotals[ft].amount += ftAmount

        nozzleRows.push({ fuelType: ft, rows, totals: entryFuelTotals[ft] })
      }

      entryGroups.push({ entryIndex: helperEntry.entryIndex, entryId: currentEntry.id || null, nozzleRows, fuelTotals: entryFuelTotals })
    }

    // ── Tanks ──
    const tanksByFuel = {}
    const dayReceipt = receiptByDate[date] || { supplyByTankId: {} }
    const supplyByTankId = dayReceipt.supplyByTankId

    for (const ft of fuelTypes) {
      const lastHelperEntry = helperEntries[helperEntries.length - 1]
      const firstTanks = helperEntries[0]?.fuelGroups[ft]?.tanks || []
      const lastTanks = lastHelperEntry?.fuelGroups[ft]?.tanks || []

      const tankRows = lastTanks.map((t, idx) => {
        const opening = firstTanks[idx]?.opening ?? t.opening
        const closing = t.closing
        const diff = Math.abs(closing - opening)
        const supply = supplyByTankId[t.tankId] || 0
        const dispensed = dispensedByTankId[t.tankId] || 0
        const ovsh = (closing - opening) - supply + dispensed
        return { label: t.label, tankId: t.tankId, opening, closing, diff, supply, dispensed, ovsh }
      })

      const totalOpening = tankRows.reduce((s, t) => s + t.opening, 0)
      const totalClosing = tankRows.reduce((s, t) => s + t.closing, 0)
      const totalSupply = tankRows.reduce((s, t) => s + t.supply, 0)
      const totalDispensed = dayFuelTotals[ft].dispensed
      const totalDiff = Math.abs(totalClosing - totalOpening)
      const totalOvsh = (totalClosing - totalOpening) - totalSupply + totalDispensed

      tanksByFuel[ft] = { tanks: tankRows, totalOpening, totalClosing, totalSupply, totalDispensed, totalDiff, totalOvsh }
    }

    const tankSummaryRows = fuelTypes.map(ft => ({
      fuelType: ft,
      ...tanksByFuel[ft],
    }))

    // ── Lodgements ──
    const dayLodgement = lodgementByDate[date] || { bankRows: [], totalPOS: 0, totalDeposits: 0, totalCash: 0, totalOther: 0, totalAll: 0 }

    // ── Consumption ──
    const dateConsumption = consumption.filter(c => c.entryDate === date)

    // ── Edit IDs ──
    const dateReceipts = receipts.filter(r => r.entryDate === date)
    const dateLodgements = lodgements.filter(l => (l.salesDate || l.entryDate) === date)
    const editIds = {
      receipt: dateReceipts[0]?.id || null,
      lodgement: dateLodgements[0]?.id || null,
      consumption: dateConsumption[0]?.id || null,
    }

    // ── Summary ──
    const totalSales = fuelTypes.reduce((s, ft) => s + dayFuelTotals[ft].amount, 0)
    const cashBalance = totalSales - dayLodgement.totalPOS

    return {
      date,
      entryGroups,
      dayFuelTotals,
      tankSummaryRows,
      tanksByFuel,
      lodgement: dayLodgement,
      todayConsumption: dateConsumption,
      editIds,
      totalSales,
      cashBalance,
      hasEntry,
      entryCount,
    }
  })

  return { dateReports, fuelTypes }
}
