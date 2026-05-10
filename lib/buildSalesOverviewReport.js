import {
  sortEntries,
  getFuelTypes,
  calculateDateRangeNozzles,
  computeDayFuelTotals,
} from './salesCalculations'

/**
 * Build the period-level Sales Overview report.
 *
 * One row per day in the range. Per fuel type, returns:
 *   - volume     = net sales = dispensed - consumption - pour back  (Excel SALES col C/E/F)
 *   - price      = closing price for the day                        (Excel SALES col G/H/I)
 *   - dispensed  = total pump dispensed                             (Excel SALES col J/K/L)
 *   - amount     = volume * price                                   (Excel SALES col M/N/O)
 *
 * PMS rolling average (Excel SALES col D) is the cumulative PMS volume divided
 * by the count of days elapsed so far in the period.
 *
 * @returns {{
 *   fuelTypes: string[],
 *   rows: Array<{ date: string, hasEntry: boolean, pmsAvg: number, fuels: Object }>,
 *   totals: { [fuelType]: { volume, dispensed, amount } }
 * } | null}
 */
export function buildSalesOverviewReport({ sales, nozzles, tanks, startDate, endDate }) {
  if (!nozzles?.length) return null

  const fuelTypes = getFuelTypes(nozzles)
  const allSorted = sortEntries(sales || [])
  const range = calculateDateRangeNozzles(allSorted, nozzles, startDate, endDate, tanks || [])

  // Group entries by date for computeDayFuelTotals
  const entriesByDate = {}
  for (const e of allSorted) {
    if (!entriesByDate[e.entryDate]) entriesByDate[e.entryDate] = []
    entriesByDate[e.entryDate].push(e)
  }

  const totals = {}
  for (const ft of fuelTypes) totals[ft] = { volume: 0, dispensed: 0, amount: 0 }

  let pmsCumulative = 0
  let dayCount = 0

  const rows = range.dates.map(({ date, entries: helperEntries, hasEntry }) => {
    const dateEntries = entriesByDate[date] || []
    const { dayFuelTotals } = computeDayFuelTotals({
      helperEntries,
      dateEntries,
      fuelTypes,
      allSorted,
      date,
    })

    const fuels = {}
    for (const ft of fuelTypes) {
      const t = dayFuelTotals[ft]
      const volume = t.actual
      const price = t.price
      const dispensed = t.dispensed
      const amount = t.amount
      fuels[ft] = { volume, price, dispensed, amount }
      totals[ft].volume += volume
      totals[ft].dispensed += dispensed
      totals[ft].amount += amount
    }

    dayCount += 1
    pmsCumulative += fuels.PMS?.volume || 0
    const pmsAvg = pmsCumulative === 0 ? 0 : pmsCumulative / dayCount

    return { date, hasEntry, fuels, pmsAvg }
  })

  return { fuelTypes, rows, totals }
}
