/**
 * Sales calculation helpers for daily sales reports.
 *
 * All functions expect entries normalised to camelCase with:
 *   { entryDate, nozzleReadings: [{ pump_id, closing_meter }], tankReadings: [{ tank_id, closing_stock }], prices, createdAt }
 *
 * Nozzle config objects: { id, fuel_type, pump_number, initial_reading }
 * Tank config objects:   { id, fuel_type, tank_number, opening_stock }
 */

const FUEL_ORDER = ['PMS', 'AGO', 'DPK']

/**
 * Sort entries by entryDate, then by meter reading order within a day.
 *
 * Within the same day, pump meters only ever increase. The entry with lower
 * closing meters is the earlier shift. Using createdAt is unreliable because
 * a user may add a forgotten earlier-shift entry after a later-shift entry
 * already exists, giving it a newer createdAt despite representing an
 * earlier point in time.
 *
 * Algorithm: for each pair of same-day entries, find any shared pump and
 * compare their closing_meter values — lower comes first. Fall back to
 * createdAt when no shared pumps exist or meters are identical.
 */
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const dateCmp = (a.entryDate || '').localeCompare(b.entryDate || '')
    if (dateCmp !== 0) return dateCmp

    // Same date: sort by meter readings (lower closing meter = earlier shift)
    const aMap = {}
    for (const r of (a.nozzleReadings || [])) aMap[r.pump_id] = Number(r.closing_meter || 0)
    for (const r of (b.nozzleReadings || [])) {
      const bVal = Number(r.closing_meter || 0)
      const aVal = aMap[r.pump_id]
      if (aVal != null && aVal !== bVal) return aVal - bVal
    }

    // No shared pump with different values — fall back to createdAt
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })
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
 * Get tanks for a fuel type, sorted by tank_number.
 */
function getTanksForFuel(tanks, fuelType) {
  return tanks
    .filter(t => t.fuel_type === fuelType)
    .sort((a, b) => Number(a.tank_number) - Number(b.tank_number))
}

/**
 * Calculate nozzle and tank readings for a single entry.
 *
 * @param {Object} entry       - The current daily sales entry
 * @param {Object|null} prevEntry - The previous entry (for opening values)
 * @param {Array} nozzles      - Nozzle config array
 * @param {Array} tanks        - Tank config array (optional)
 * @returns {Object} { fuelGroups: { [fuelType]: { nozzles, tanks, totals } }, fuelTypes }
 */
function calculateEntryNozzles(entry, prevEntry, nozzles, tanks = []) {
  const fuelTypes = getFuelTypes(nozzles)
  const fuelGroups = {}

  for (const ft of fuelTypes) {
    const ftNozzles = getNozzlesForFuel(nozzles, ft)
    let totalDispensed = 0

    const nozzleRows = ftNozzles.map(n => {
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

    // Tank stock calculations (same chaining pattern as nozzles)
    const ftTanks = getTanksForFuel(tanks, ft)
    let totalTankOpening = 0
    let totalTankClosing = 0
    let totalTankDiff = 0

    const tankRows = ftTanks.map(t => {
      const currentR = (entry.tankReadings || []).find(r => r.tank_id === t.id)
      const prevR = (prevEntry?.tankReadings || []).find(r => r.tank_id === t.id)

      const opening = prevR ? Number(prevR.closing_stock || 0) : Number(t.opening_stock || 0)
      const closing = currentR ? Number(currentR.closing_stock || 0) : opening
      const diff = closing - opening

      totalTankOpening += opening
      totalTankClosing += closing
      totalTankDiff += diff

      return {
        tankId: t.id,
        label: `${ft} ${t.tank_number}`,
        opening,
        closing,
        diff,
      }
    })

    fuelGroups[ft] = {
      nozzles: nozzleRows,
      tanks: tankRows,
      totals: {
        dispensed: totalDispensed,
        tankOpening: totalTankOpening,
        tankClosing: totalTankClosing,
        tankDiff: totalTankDiff,
      },
    }
  }

  return { fuelGroups, fuelTypes }
}

/**
 * Calculate nozzle and tank readings for all entries on a given date.
 *
 * Entries chain within the same day: entry 2 uses entry 1's closing as opening, etc.
 *
 * @param {Array} allEntries  - All daily sales entries (will be sorted internally)
 * @param {Array} nozzles     - Nozzle config array
 * @param {Array} tanks       - Tank config array
 * @param {string} date       - The date to calculate for (YYYY-MM-DD)
 * @returns {Object} { entries: [...], dayTotals: { [fuelType]: { dispensed, tankOpening, tankClosing, tankDiff } }, fuelTypes, hasEntry }
 */
function calculateDateNozzles(allEntries, nozzles, tanks, date) {
  const sorted = sortEntries(allEntries)
  const todayEntries = sorted.filter(e => e.entryDate === date)
  const prevDayEntry = getPrevDayEntry(sorted, date)
  const fuelTypes = getFuelTypes(nozzles)

  const dayTotals = {}
  for (const ft of fuelTypes) {
    dayTotals[ft] = { dispensed: 0, tankOpening: 0, tankClosing: 0, tankDiff: 0 }
  }

  const entries = []

  if (todayEntries.length === 0) {
    // No entries — show carried-forward zeros
    const { fuelGroups } = calculateEntryNozzles(
      { nozzleReadings: [], tankReadings: [] },
      prevDayEntry,
      nozzles,
      tanks
    )
    // Zero out since there's no actual entry
    for (const ft of fuelTypes) {
      fuelGroups[ft].nozzles = fuelGroups[ft].nozzles.map(n => ({
        ...n, closing: n.opening, dispensed: 0,
      }))
      fuelGroups[ft].tanks = fuelGroups[ft].tanks.map(t => ({
        ...t, closing: t.opening, diff: 0,
      }))
      fuelGroups[ft].totals = { dispensed: 0, tankOpening: fuelGroups[ft].totals.tankOpening, tankClosing: fuelGroups[ft].totals.tankOpening, tankDiff: 0 }
    }
    entries.push({ entryIndex: 1, fuelGroups })
  } else {
    for (let i = 0; i < todayEntries.length; i++) {
      const { fuelGroups } = calculateEntryNozzles(
        todayEntries[i],
        i === 0 ? prevDayEntry : todayEntries[i - 1],
        nozzles,
        tanks
      )

      for (const ft of fuelTypes) {
        dayTotals[ft].dispensed += fuelGroups[ft].totals.dispensed
        dayTotals[ft].tankDiff += fuelGroups[ft].totals.tankDiff
      }

      // Day-level opening = first entry's opening, closing = last entry's closing
      if (i === 0) {
        for (const ft of fuelTypes) {
          dayTotals[ft].tankOpening = fuelGroups[ft].totals.tankOpening
        }
      }
      if (i === todayEntries.length - 1) {
        for (const ft of fuelTypes) {
          dayTotals[ft].tankClosing = fuelGroups[ft].totals.tankClosing
        }
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
 * Calculate nozzle and tank readings for a date range.
 * Optimized: sorts once, groups entries by date, and carries prev entry forward.
 *
 * @param {Array} allEntries  - All daily sales entries
 * @param {Array} nozzles     - Nozzle config array
 * @param {string} startDate  - Start date (YYYY-MM-DD)
 * @param {string} endDate    - End date (YYYY-MM-DD)
 * @param {Array} tanks       - Tank config array (optional, defaults to [])
 * @returns {Object} { dates: [{ date, entries, dayTotals, hasEntry, entryCount }], fuelTypes }
 */
function calculateDateRangeNozzles(allEntries, nozzles, startDate, endDate, tanks = []) {
  const fuelTypes = getFuelTypes(nozzles)
  const sorted = sortEntries(allEntries)
  const dateStrings = getDateRange(startDate, endDate)

  // Group sorted entries by date (O(n) scan)
  const entriesByDate = {}
  for (const e of sorted) {
    if (!entriesByDate[e.entryDate]) entriesByDate[e.entryDate] = []
    entriesByDate[e.entryDate].push(e)
  }

  // Find the last entry before the range start (for opening values on day 1)
  let prevEntry = getPrevDayEntry(sorted, startDate)

  const dates = dateStrings.map(date => {
    const todayEntries = entriesByDate[date] || []
    const dayTotals = {}
    for (const ft of fuelTypes) {
      dayTotals[ft] = { dispensed: 0, tankOpening: 0, tankClosing: 0, tankDiff: 0 }
    }

    const entries = []

    if (todayEntries.length === 0) {
      const { fuelGroups } = calculateEntryNozzles(
        { nozzleReadings: [], tankReadings: [] },
        prevEntry,
        nozzles,
        tanks
      )
      for (const ft of fuelTypes) {
        fuelGroups[ft].nozzles = fuelGroups[ft].nozzles.map(n => ({
          ...n, closing: n.opening, dispensed: 0,
        }))
        fuelGroups[ft].tanks = fuelGroups[ft].tanks.map(t => ({
          ...t, closing: t.opening, diff: 0,
        }))
        fuelGroups[ft].totals = { dispensed: 0, tankOpening: fuelGroups[ft].totals.tankOpening, tankClosing: fuelGroups[ft].totals.tankOpening, tankDiff: 0 }
      }
      entries.push({ entryIndex: 1, fuelGroups })
      // prevEntry stays the same (no new entry to carry forward)
    } else {
      for (let i = 0; i < todayEntries.length; i++) {
        const { fuelGroups } = calculateEntryNozzles(
          todayEntries[i],
          i === 0 ? prevEntry : todayEntries[i - 1],
          nozzles,
          tanks
        )

        for (const ft of fuelTypes) {
          dayTotals[ft].dispensed += fuelGroups[ft].totals.dispensed
          dayTotals[ft].tankDiff += fuelGroups[ft].totals.tankDiff
        }

        if (i === 0) {
          for (const ft of fuelTypes) {
            dayTotals[ft].tankOpening = fuelGroups[ft].totals.tankOpening
          }
        }
        if (i === todayEntries.length - 1) {
          for (const ft of fuelTypes) {
            dayTotals[ft].tankClosing = fuelGroups[ft].totals.tankClosing
          }
        }

        entries.push({ entryIndex: i + 1, fuelGroups })
      }
      // Carry forward the last entry of this day
      prevEntry = todayEntries[todayEntries.length - 1]
    }

    return {
      date,
      entries,
      dayTotals,
      fuelTypes,
      hasEntry: todayEntries.length > 0,
      entryCount: todayEntries.length,
    }
  })

  return { dates, fuelTypes }
}

/**
 * Compute per-day fuel totals from helperEntries (nozzle calculation output).
 *
 * Single source of truth for:
 *   - per-entry fuel totals (dispensed, consumed, actual, price, amount, pourBack)
 *   - day-level fuel totals (accumulated across entries, with correct price handling)
 *
 * Consumption and pour-back are read from each entry's nozzleReadings (per-nozzle).
 * db.consumption entries are for account tracking only, not used in calculations.
 *
 * Used by buildDailyReport, buildAuditReport (lodgement sheet), and any report
 * that needs per-day sales totals.
 *
 * @param {Object} params
 * @param {Array}  params.helperEntries - From calculateDateRangeNozzles: [{ entryIndex, fuelGroups }]
 * @param {Array}  params.dateEntries   - Sorted daily sales entries for this date
 * @param {Array}  params.fuelTypes     - ['PMS', 'AGO', 'DPK']
 * @param {Array}  params.allSorted     - All daily sales entries sorted (for prevPrices fallback)
 * @param {string} params.date          - The date being computed (YYYY-MM-DD)
 * @returns {{ dayFuelTotals: Object, entryGroups: Array }}
 */
function computeDayFuelTotals({ helperEntries, dateEntries, fuelTypes, allSorted, date }) {
  const dayFuelTotals = {}
  for (const ft of fuelTypes) {
    dayFuelTotals[ft] = { dispensed: 0, consumed: 0, actual: 0, price: 0, amount: 0, pourBack: 0 }
  }

  // Carry forward prices for no-entry days
  let prevPrices = {}
  if (dateEntries.length === 0) {
    for (let i = allSorted.length - 1; i >= 0; i--) {
      if (allSorted[i].entryDate < date) { prevPrices = allSorted[i].prices || {}; break }
    }
  }

  const entryGroups = []

  for (let i = 0; i < helperEntries.length; i++) {
    const helperEntry = helperEntries[i]
    const currentEntry = dateEntries[i] || {}
    const entryFuelTotals = {}

    for (const ft of fuelTypes) {
      const fg = helperEntry.fuelGroups[ft]
      const price = Number(currentEntry.prices?.[ft]) || Number(prevPrices[ft]) || 0

      let ftConsumed = 0
      let ftPourBack = 0
      for (const n of fg.nozzles) {
        const currentR = (currentEntry.nozzleReadings || []).find(r => r.pump_id === n.pumpId)
        ftConsumed += currentR ? Number(currentR.consumption || 0) : 0
        ftPourBack += currentR ? Number(currentR.pour_back || 0) : 0
      }

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
      if (price > 0) dayFuelTotals[ft].price = price
      dayFuelTotals[ft].amount += ftAmount
    }

    entryGroups.push({
      entryIndex: helperEntry.entryIndex,
      entryId: currentEntry.id || null,
      fuelTotals: entryFuelTotals,
    })
  }

  return { dayFuelTotals, entryGroups }
}

export {
  sortEntries,
  getPrevDayEntry,
  getFuelTypes,
  getNozzlesForFuel,
  getTanksForFuel,
  calculateEntryNozzles,
  calculateDateNozzles,
  calculateDateRangeNozzles,
  computeDayFuelTotals,
}
