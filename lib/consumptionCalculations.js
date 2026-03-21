/**
 * Consumption / pour-back calculation helpers for reports.
 *
 * Derives ALL consumption data from daily sales nozzle readings.
 * Each nozzle reading has: { consumption, pour_back, consumption_customer_id, fuel_type }
 *
 * Output shape matches the old consumption_entries-based version so reports
 * work without changes.
 */

const FUEL_ORDER = ['PMS', 'AGO', 'DPK']

/**
 * Generate all YYYY-MM-DD strings from startDate to endDate inclusive.
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

/**
 * Extract consumption and pour-back data from daily sales nozzle readings
 * for a date range.
 *
 * @param {Array}  allSales   - All dailySales entries for the org (camelCase)
 * @param {string} startDate  - YYYY-MM-DD
 * @param {string} endDate    - YYYY-MM-DD
 * @returns {{ dates: Array }}
 *
 * Each date object:
 * {
 *   date, entries,
 *   byFuelType: { PMS: { consumed, pourBack, entries }, ... },
 *   totalConsumed, totalPourBack,
 *   hasEntry, entryCount,
 * }
 *
 * Each synthetic entry in entries[]:
 * { id, entryDate, customerId, quantity, fuelType, isPourBack, price }
 */
function calculateDateRangeConsumption(allSales, startDate, endDate) {
  const dateStrings = getDateRange(startDate, endDate)

  // Group sales by date
  const salesByDate = {}
  for (const sale of allSales) {
    const d = sale.entryDate || ''
    if (!salesByDate[d]) salesByDate[d] = []
    salesByDate[d].push(sale)
  }


  const dates = dateStrings.map(date => {
    const daySales = salesByDate[date] || []
    const entries = []

    const byFuelType = {}
    for (const ft of FUEL_ORDER) {
      byFuelType[ft] = { consumed: 0, pourBack: 0, entries: [] }
    }

    for (const sale of daySales) {
      const readings = sale.nozzleReadings || []
      for (const r of readings) {
        const ft = r.fuel_type || ''
        if (!byFuelType[ft]) byFuelType[ft] = { consumed: 0, pourBack: 0, entries: [] }

        const consQty = Number(r.consumption || 0)
        const pbQty = Number(r.pour_back || 0)
        const custId = r.consumption_customer_id || null
        const price = Number(sale.prices?.[ft] || 0)

        if (consQty > 0) {
          const entry = {
            id: `${sale.id}_${r.pump_id}_cons`,
            entryDate: date,
            customerId: custId,
            quantity: consQty,
            fuelType: ft,
            isPourBack: false,
            price,
          }
          byFuelType[ft].consumed += consQty
          byFuelType[ft].entries.push(entry)
          entries.push(entry)
        }

        if (pbQty > 0) {
          const entry = {
            id: `${sale.id}_${r.pump_id}_pb`,
            entryDate: date,
            customerId: custId,
            quantity: pbQty,
            fuelType: ft,
            isPourBack: true,
            price,
          }
          byFuelType[ft].pourBack += pbQty
          byFuelType[ft].entries.push(entry)
          entries.push(entry)
        }
      }
    }

    let totalConsumed = 0
    let totalPourBack = 0
    for (const ft of Object.keys(byFuelType)) {
      totalConsumed += byFuelType[ft].consumed
      totalPourBack += byFuelType[ft].pourBack
    }

    return {
      date,
      entries,
      byFuelType,
      totalConsumed,
      totalPourBack,
      hasEntry: entries.length > 0,
      entryCount: entries.length,
    }
  })

  return { dates }
}

export {
  calculateDateRangeConsumption,
}
