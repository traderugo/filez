/**
 * Sales calculation helpers for daily sales reports.
 *
 * All functions expect entries normalised to camelCase with:
 *   { entryDate, nozzleReadings: [{ pump_id, closing_meter }], prices, createdAt }
 *
 * Nozzle config objects: { id, fuel_type, pump_number, initial_reading }
 */

const FUEL_ORDER = ['PMS', 'AGO', 'DPK']

/**
 * Sort entries by entryDate then createdAt.
 */
function sortEntries(entries) {
  return [...entries].sort((a, b) =>
    (a.entryDate || '').localeCompare(b.entryDate || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )
}

/**
 * Get the last entry strictly before `date` from a sorted array.
 */
function getPrevDayEntry(sortedEntries, date) {
  for (let i = sortedEntries.length - 1; i >= 0; i--) {
    if (sortedEntries[i].entryDate < date) return sortedEntries[i]
  }
  return null
}

/**
 * Get ordered fuel types present in nozzle config.
 * Always PMS first, then AGO, then DPK.
 */
function getFuelTypes(nozzles) {
  return FUEL_ORDER.filter(ft => nozzles.some(n => n.fuel_type === ft))
}

/**
 * Get nozzles for a fuel type, sorted by pump_number.
 */
function getNozzlesForFuel(nozzles, fuelType) {
  return nozzles
    .filter(n => n.fuel_type === fuelType)
    .sort((a, b) => Number(a.pump_number) - Number(b.pump_number))
}

/**
 * Calculate nozzle readings for a single entry.
 *
 * @param {Object} entry       - The current daily sales entry
 * @param {Object|null} prevEntry - The previous entry (for opening values)
 * @param {Array} nozzles      - Nozzle config array
 * @returns {Object} { fuelGroups: { [fuelType]: { nozzles: [...], totals } }, fuelTypes }
 */
function calculateEntryNozzles(entry, prevEntry, nozzles) {
  const fuelTypes = getFuelTypes(nozzles)
  const fuelGroups = {}

  for (const ft of fuelTypes) {
    const ftNozzles = getNozzlesForFuel(nozzles, ft)
    let totalDispensed = 0

    const rows = ftNozzles.map(n => {
      const currentR = (entry.nozzleReadings || []).find(r => r.pump_id === n.id)
      const prevR = (prevEntry?.nozzleReadings || []).find(r => r.pump_id === n.id)

      const opening = prevR ? Number(prevR.closing_meter || 0) : Number(n.initial_reading || 0)
      const closing = currentR ? Number(currentR.closing_meter || 0) : opening
      const dispensed = closing - opening

      totalDispensed += dispensed

      return {
        pumpId: n.id,
        label: `${ft} ${n.pump_number}`,
        opening,
        closing,
        dispensed,
      }
    })

    fuelGroups[ft] = {
      nozzles: rows,
      totals: { dispensed: totalDispensed },
    }
  }

  return { fuelGroups, fuelTypes }
}

/**
 * Calculate nozzle readings for all entries on a given date.
 *
 * All entries on the same date use the previous DAY's last closing as opening.
 *
 * @param {Array} allEntries  - All daily sales entries (will be sorted internally)
 * @param {Array} nozzles     - Nozzle config array
 * @param {string} date       - The date to calculate for (YYYY-MM-DD)
 * @returns {Object} { entries: [...], dayTotals: { [fuelType]: { dispensed } }, fuelTypes, hasEntry }
 */
function calculateDateNozzles(allEntries, nozzles, date) {
  const sorted = sortEntries(allEntries)
  const todayEntries = sorted.filter(e => e.entryDate === date)
  const prevDayEntry = getPrevDayEntry(sorted, date)
  const fuelTypes = getFuelTypes(nozzles)

  const dayTotals = {}
  for (const ft of fuelTypes) {
    dayTotals[ft] = { dispensed: 0 }
  }

  const entries = []

  if (todayEntries.length === 0) {
    // No entries — show carried-forward zeros
    const { fuelGroups } = calculateEntryNozzles(
      { nozzleReadings: [] },
      prevDayEntry,
      nozzles
    )
    // Zero out dispensed since there's no actual entry
    for (const ft of fuelTypes) {
      fuelGroups[ft].nozzles = fuelGroups[ft].nozzles.map(n => ({
        ...n,
        closing: n.opening,
        dispensed: 0,
      }))
      fuelGroups[ft].totals = { dispensed: 0 }
    }
    entries.push({ entryIndex: 1, fuelGroups })
  } else {
    for (let i = 0; i < todayEntries.length; i++) {
      const { fuelGroups } = calculateEntryNozzles(
        todayEntries[i],
        prevDayEntry, // all entries on same day use prev day's closing
        nozzles
      )

      for (const ft of fuelTypes) {
        dayTotals[ft].dispensed += fuelGroups[ft].totals.dispensed
      }

      entries.push({ entryIndex: i + 1, fuelGroups })
    }
  }

  return {
    entries,
    dayTotals,
    fuelTypes,
    hasEntry: todayEntries.length > 0,
    entryCount: todayEntries.length,
  }
}

/**
 * Generate all YYYY-MM-DD strings from startDate to endDate inclusive.
 */
function getDateRange(startDate, endDate) {
  const dates = []
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dates
}

/**
 * Calculate nozzle readings for a date range.
 *
 * @param {Array} allEntries  - All daily sales entries
 * @param {Array} nozzles     - Nozzle config array
 * @param {string} startDate  - Start date (YYYY-MM-DD)
 * @param {string} endDate    - End date (YYYY-MM-DD)
 * @returns {Object} { dates: [{ date, entries, dayTotals, hasEntry, entryCount }], fuelTypes }
 */
function calculateDateRangeNozzles(allEntries, nozzles, startDate, endDate) {
  const fuelTypes = getFuelTypes(nozzles)
  const dateStrings = getDateRange(startDate, endDate)

  const dates = dateStrings.map(date => {
    const result = calculateDateNozzles(allEntries, nozzles, date)
    return { date, ...result }
  })

  return { dates, fuelTypes }
}

export {
  sortEntries,
  getPrevDayEntry,
  getFuelTypes,
  getNozzlesForFuel,
  calculateEntryNozzles,
  calculateDateNozzles,
  calculateDateRangeNozzles,
}
