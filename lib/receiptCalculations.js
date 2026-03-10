/**
 * Product receipt calculation helpers for reports.
 *
 * Entries normalised to camelCase:
 *   { id, entryDate, tankId, actualVolume, waybillNumber, truckNumber,
 *     driverName, depotName, loadedDate, ticketNumber,
 *     firstCompartment, secondCompartment, thirdCompartment,
 *     chartUllage, chartLiquidHeight, depotUllage, depotLiquidHeight,
 *     stationUllage, stationLiquidHeight, notes, createdAt }
 *
 * Tank config objects: { id, fuel_type, tank_number }
 */

const FUEL_ORDER = ['PMS', 'AGO', 'DPK']

/**
 * Sort receipts by entryDate then createdAt.
 */
function sortReceipts(entries) {
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
 * Get ordered fuel types present in tank config.
 */
function getFuelTypes(tanks) {
  return FUEL_ORDER.filter(ft => tanks.some(t => t.fuel_type === ft))
}

/**
 * Calculate product receipt data for a date range.
 * Optimized: sorts once, groups by date.
 *
 * @param {Array} allReceipts - All product receipt entries
 * @param {Array} tanks       - Tank config array
 * @param {string} startDate  - Start date (YYYY-MM-DD)
 * @param {string} endDate    - End date (YYYY-MM-DD)
 * @returns {Object} { dates: [...], fuelTypes }
 */
function calculateDateRangeReceipts(allReceipts, tanks, startDate, endDate) {
  const sorted = sortReceipts(allReceipts)
  const fuelTypes = getFuelTypes(tanks)
  const dateStrings = getDateRange(startDate, endDate)

  // Build tank lookup
  const tankMap = {}
  for (const t of tanks) {
    tankMap[t.id] = t
  }

  // Group sorted entries by entryDate (O(n) scan)
  const entriesByDate = {}
  for (const e of sorted) {
    const d = e.entryDate || ''
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  const dates = dateStrings.map(date => {
    const dayReceipts = entriesByDate[date] || []

    // Enrich each receipt with tank info
    const receipts = dayReceipts.map(r => {
      const tank = tankMap[r.tankId]
      return {
        id: r.id,
        tankId: r.tankId,
        tankLabel: tank ? `${tank.fuel_type} ${tank.tank_number}` : 'Unknown',
        fuelType: tank?.fuel_type || '',
        actualVolume: Number(r.actualVolume || 0),
        waybillNumber: r.waybillNumber || '',
        truckNumber: r.truckNumber || '',
        driverName: r.driverName || '',
        depotName: r.depotName || '',
        loadedDate: r.loadedDate || '',
        ticketNumber: r.ticketNumber || '',
        firstCompartment: Number(r.firstCompartment || 0),
        secondCompartment: Number(r.secondCompartment || 0),
        thirdCompartment: Number(r.thirdCompartment || 0),
        chartUllage: Number(r.chartUllage || 0),
        chartLiquidHeight: Number(r.chartLiquidHeight || 0),
        depotUllage: Number(r.depotUllage || 0),
        depotLiquidHeight: Number(r.depotLiquidHeight || 0),
        stationUllage: Number(r.stationUllage || 0),
        stationLiquidHeight: Number(r.stationLiquidHeight || 0),
        notes: r.notes || '',
      }
    })

    // Sum per tank
    const supplyByTankId = {}
    for (const r of receipts) {
      if (r.tankId) {
        supplyByTankId[r.tankId] = (supplyByTankId[r.tankId] || 0) + r.actualVolume
      }
    }

    // Build per-fuel-type breakdown with per-tank rows
    const fuelBreakdown = fuelTypes.map(ft => {
      const ftTanks = tanks
        .filter(t => t.fuel_type === ft)
        .sort((a, b) => Number(a.tank_number) - Number(b.tank_number))

      const tankRows = ftTanks.map(t => ({
        tankId: t.id,
        label: `${ft} ${t.tank_number}`,
        volume: supplyByTankId[t.id] || 0,
      }))

      const totalVolume = tankRows.reduce((s, t) => s + t.volume, 0)

      return {
        fuelType: ft,
        tanks: tankRows,
        totalVolume,
        tankCount: ftTanks.length,
      }
    })

    const totalVolume = fuelBreakdown.reduce((s, fb) => s + fb.totalVolume, 0)

    return {
      date,
      receipts,
      supplyByTankId,
      fuelBreakdown,
      totalVolume,
      hasEntry: dayReceipts.length > 0,
      entryCount: dayReceipts.length,
    }
  })

  return { dates, fuelTypes }
}

export {
  sortReceipts,
  calculateDateRangeReceipts,
}
