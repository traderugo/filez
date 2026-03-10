/**
 * Consumption / pour-back calculation helpers for reports.
 *
 * Entries normalised to camelCase:
 *   { id, entryDate, customerId, quantity, fuelType, isPourBack, notes, createdAt }
 */

const FUEL_ORDER = ['PMS', 'AGO', 'DPK']

/**
 * Sort consumption entries by entryDate then createdAt.
 */
function sortConsumption(entries) {
  return [...entries].sort((a, b) =>
    (a.entryDate || '').localeCompare(b.entryDate || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )
}

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
 * Calculate consumption and pour-back data for a date range.
 *
 * @param {Array}  allConsumption - All consumption entries for the org
 * @param {string} startDate     - YYYY-MM-DD
 * @param {string} endDate       - YYYY-MM-DD
 * @returns {{ dates: Array }}
 *
 * Each date object:
 * {
 *   date, entries,
 *   byFuelType: { PMS: { consumed, pourBack, entries }, ... },
 *   totalConsumed, totalPourBack,
 *   hasEntry, entryCount,
 * }
 */
function calculateDateRangeConsumption(allConsumption, startDate, endDate) {
  const sorted = sortConsumption(allConsumption)
  const dateStrings = getDateRange(startDate, endDate)

  // Group by date (O(n) scan)
  const entriesByDate = {}
  for (const e of sorted) {
    const d = e.entryDate || ''
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  const dates = dateStrings.map(date => {
    const dayEntries = entriesByDate[date] || []

    const byFuelType = {}
    for (const ft of FUEL_ORDER) {
      byFuelType[ft] = { consumed: 0, pourBack: 0, entries: [] }
    }

    for (const e of dayEntries) {
      const ft = e.fuelType
      if (!byFuelType[ft]) byFuelType[ft] = { consumed: 0, pourBack: 0, entries: [] }
      const qty = Number(e.quantity || 0)
      if (e.isPourBack) {
        byFuelType[ft].pourBack += qty
      } else {
        byFuelType[ft].consumed += qty
      }
      byFuelType[ft].entries.push(e)
    }

    let totalConsumed = 0
    let totalPourBack = 0
    for (const ft of Object.keys(byFuelType)) {
      totalConsumed += byFuelType[ft].consumed
      totalPourBack += byFuelType[ft].pourBack
    }

    return {
      date,
      entries: dayEntries,
      byFuelType,
      totalConsumed,
      totalPourBack,
      hasEntry: dayEntries.length > 0,
      entryCount: dayEntries.length,
    }
  })

  return { dates }
}

export {
  sortConsumption,
  calculateDateRangeConsumption,
}
