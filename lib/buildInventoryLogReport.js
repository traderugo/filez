import {
  sortEntries,
  getFuelTypes,
  getTanksForFuel,
  calculateDateRangeNozzles,
} from './salesCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'

/**
 * Build the period-level Inventory Log report.
 *
 * Mirrors the Excel INVENTORY sheet. One row per day, per fuel type:
 *   - tanks[]          per-tank closing stock                     (Excel C-G)
 *   - totalClosing     sum of per-tank closing stock              (Excel E for PMS)
 *   - tankOvsh         (totalClosing - totalOpening) - actualSupply + dispensed   (Excel H-L)
 *   - actualOvsh       tankOvsh - pourBack                        (Excel M/N/O)
 *   - ugtDispensed     pump dispensed total                       (Excel S/T/U)
 *   - expectedSupply   sum of waybill compartments per fuel       (Excel W/X/Y)
 *   - actualSupply     sum of UGT-dipped actualVolume             (Excel Z/AA/AB)
 *   - driverShortage   expectedSupply - actualSupply              (Excel AC/AD/AE)
 *   - variance         (ugtDispensed * 0.0125 - driverShortage - actualOvsh) * sign  (Excel P/Q/R)
 *                      sign = -1 for PMS and DPK, +1 for AGO
 *
 * @returns {{
 *   fuelTypes: string[],
 *   tanksByFuel: { [ft]: Array },
 *   rows: Array,
 *   totals: { [ft]: Object }
 * } | null}
 */
export function buildInventoryLogReport({ sales, receipts, nozzles, tanks, startDate, endDate }) {
  if (!nozzles?.length) return null

  const fuelTypes = getFuelTypes(nozzles)
  const tanksByFuel = {}
  for (const ft of fuelTypes) tanksByFuel[ft] = getTanksForFuel(tanks || [], ft)

  const allSorted = sortEntries(sales || [])
  const range = calculateDateRangeNozzles(allSorted, nozzles, startDate, endDate, tanks || [])
  const receiptResult = calculateDateRangeReceipts(receipts || [], tanks || [], startDate, endDate)

  const receiptByDate = {}
  for (const rd of receiptResult.dates) receiptByDate[rd.date] = rd

  // Group entries by date
  const entriesByDate = {}
  for (const e of allSorted) {
    if (!entriesByDate[e.entryDate]) entriesByDate[e.entryDate] = []
    entriesByDate[e.entryDate].push(e)
  }

  // Tank fuel lookup for delivery grouping
  const tankFuelMap = {}
  for (const t of tanks || []) tankFuelMap[t.id] = t.fuel_type

  // Tank-level prev COB readings (carried forward)
  let prevCobTankReadings = null
  // Find the last COB entry strictly before startDate to seed openings
  for (let i = allSorted.length - 1; i >= 0; i--) {
    const e = allSorted[i]
    if (e.entryDate < startDate && (e.closeOfBusiness || e.close_of_business)) {
      prevCobTankReadings = e.tankReadings || []
      break
    }
  }
  if (!prevCobTankReadings) {
    // Fallback: any entry before startDate (last by sort)
    for (let i = allSorted.length - 1; i >= 0; i--) {
      const e = allSorted[i]
      if (e.entryDate < startDate) {
        prevCobTankReadings = e.tankReadings || []
        break
      }
    }
  }

  const SIGN = { PMS: -1, AGO: 1, DPK: -1 }

  const totals = {}
  for (const ft of fuelTypes) {
    totals[ft] = {
      totalClosing: 0, tankOvsh: 0, actualOvsh: 0, variance: 0,
      ugtDispensed: 0, expectedSupply: 0, actualSupply: 0, driverShortage: 0,
    }
  }

  const rows = range.dates.map(({ date }) => {
    const dayEntries = (entriesByDate[date] || []).slice().sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || '')
    )
    const dayReceipt = receiptByDate[date] || { receipts: [], supplyByTankId: {} }
    const hasEntry = dayEntries.length > 0

    // COB tank readings for this date
    const cobEntry = [...dayEntries].reverse().find(e => e.closeOfBusiness || e.close_of_business)
    const tankEntry = cobEntry || dayEntries[dayEntries.length - 1] || null
    const cobTankReadings = tankEntry ? (tankEntry.tankReadings || []) : null

    // Per-fuel UGT dispensed and pour back from inline nozzle readings
    const ugtByFuel = {}
    const pourBackByFuel = {}
    for (const ft of fuelTypes) { ugtByFuel[ft] = 0; pourBackByFuel[ft] = 0 }

    // Chain nozzle meters across the day's entries to derive dispensed
    const prevClosing = {}
    // Seed from the previous day's last entry by walking allSorted
    for (let i = allSorted.length - 1; i >= 0; i--) {
      const e = allSorted[i]
      if (e.entryDate < date) {
        for (const r of (e.nozzleReadings || [])) prevClosing[r.pump_id] = Number(r.closing_meter || 0)
        break
      }
    }
    // For nozzles with no prior reading, use initial_reading
    for (const n of nozzles) {
      if (prevClosing[n.id] == null) prevClosing[n.id] = Number(n.initial_reading || 0)
    }

    for (const entry of dayEntries) {
      const readingMap = {}
      for (const r of (entry.nozzleReadings || [])) readingMap[r.pump_id] = r
      for (const n of nozzles) {
        const r = readingMap[n.id]
        if (!r || r.closing_meter == null || r.closing_meter === '') continue
        const closing = Number(r.closing_meter)
        const opening = prevClosing[n.id] || 0
        const dispensed = closing - opening
        ugtByFuel[n.fuel_type] += dispensed
        pourBackByFuel[n.fuel_type] += Number(r.pour_back || 0)
        prevClosing[n.id] = closing
      }
    }

    // Per-fuel: per-tank closing, totalClosing, totalOpening, totalActualSupply
    const fuels = {}
    for (const ft of fuelTypes) {
      const ftTanks = tanksByFuel[ft]
      let totalOpening = 0, totalClosing = 0, totalActualSupply = 0

      const tankRows = ftTanks.map(t => {
        const prevR = prevCobTankReadings ? prevCobTankReadings.find(r => r.tank_id === t.id) : null
        const opening = prevR ? Number(prevR.closing_stock || 0) : Number(t.opening_stock || 0)
        const cobR = cobTankReadings ? cobTankReadings.find(r => r.tank_id === t.id) : null
        const closing = cobR ? Number(cobR.closing_stock || 0) : opening
        const supply = dayReceipt.supplyByTankId[t.id] || 0

        totalOpening += opening
        totalClosing += closing
        totalActualSupply += supply

        return {
          tankId: t.id,
          label: `${ft} ${t.tank_number}`,
          closingStock: closing,
        }
      })

      const ugtDispensed = ugtByFuel[ft] || 0
      const pourBack = pourBackByFuel[ft] || 0
      const tankOvsh = (totalClosing - totalOpening) - totalActualSupply + ugtDispensed
      const actualOvsh = tankOvsh - pourBack

      fuels[ft] = {
        tanks: tankRows,
        totalClosing,
        totalOpening,
        tankOvsh,
        actualOvsh,
        ugtDispensed,
        pourBack,
        totalActualSupply,
      }
    }

    // Per-fuel expected/actual supply (delivery-grouped per day)
    const expByFuel = {}, actByFuel = {}
    for (const ft of fuelTypes) { expByFuel[ft] = 0; actByFuel[ft] = 0 }

    const dayReceiptList = dayReceipt.receipts || []
    const deliveryMap = {}
    for (const r of dayReceiptList) {
      const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
      const key = parts.some(Boolean) ? parts.join('|') : r.id
      if (!deliveryMap[key]) deliveryMap[key] = { first: r, records: [] }
      deliveryMap[key].records.push(r)
    }
    for (const { first, records } of Object.values(deliveryMap)) {
      const expected = Number(first.highVol1 ?? first.firstCompartment ?? 0) + Number(first.highVol2 ?? first.secondCompartment ?? 0) + Number(first.highVol3 ?? first.thirdCompartment ?? 0)
      const byFuel = {}
      for (const r of records) {
        const ft = tankFuelMap[r.tankId]
        if (!ft) continue
        if (!byFuel[ft]) byFuel[ft] = { actual: 0 }
        byFuel[ft].actual += Number(r.actualVolume || 0)
      }
      const fts = Object.keys(byFuel)
      if (fts.length === 1) {
        expByFuel[fts[0]] = (expByFuel[fts[0]] || 0) + expected
        actByFuel[fts[0]] = (actByFuel[fts[0]] || 0) + byFuel[fts[0]].actual
      } else if (fts.length > 1) {
        const totalActual = fts.reduce((s, ft) => s + byFuel[ft].actual, 0)
        for (const ft of fts) {
          const share = totalActual > 0 ? Math.round(expected * byFuel[ft].actual / totalActual) : 0
          expByFuel[ft] = (expByFuel[ft] || 0) + share
          actByFuel[ft] = (actByFuel[ft] || 0) + byFuel[ft].actual
        }
      }
    }

    // Finalise per-fuel: supply, driverShortage, variance
    for (const ft of fuelTypes) {
      const f = fuels[ft]
      const expectedSupply = expByFuel[ft] || 0
      const actualSupply = actByFuel[ft] || 0
      const driverShortage = expectedSupply - actualSupply
      const sign = SIGN[ft] ?? 1
      const variance = ((f.ugtDispensed * 0.0125) - driverShortage - f.actualOvsh) * sign

      f.expectedSupply = expectedSupply
      f.actualSupply = actualSupply
      f.driverShortage = driverShortage
      f.variance = variance

      totals[ft].totalClosing += f.totalClosing
      totals[ft].tankOvsh += f.tankOvsh
      totals[ft].actualOvsh += f.actualOvsh
      totals[ft].variance += variance
      totals[ft].ugtDispensed += f.ugtDispensed
      totals[ft].expectedSupply += expectedSupply
      totals[ft].actualSupply += actualSupply
      totals[ft].driverShortage += driverShortage
    }

    if (cobTankReadings) prevCobTankReadings = cobTankReadings

    return { date, hasEntry, fuels }
  })

  return { fuelTypes, tanksByFuel, rows, totals }
}
