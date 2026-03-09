'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Pencil } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { initialSync } from '@/lib/initialSync'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DailySalesReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <DailySalesReportContent />
    </Suspense>
  )
}

function DailySalesReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  // Report data
  const [report, setReport] = useState(null)
  const [showEditMenu, setShowEditMenu] = useState(false)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      try { await initialSync(orgId) } catch (e) { /* offline — use local data */ }
      if (cancelled) return

      const [noz, tnk, bnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
      ])

      setNozzles(noz)
      setTanks(tnk)
      setBanks(bnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  const buildReport = useCallback(async () => {
    if (!orgId || !nozzles.length) return

    // Get all daily sales entries sorted by date, then createdAt
    const rawEntries = await db.dailySales
      .where('orgId').equals(orgId)
      .toArray()

    // Defensive: normalize field names in case some entries have snake_case
    const allEntries = rawEntries.map(e => ({
      ...e,
      entryDate: e.entryDate || e.entry_date,
      nozzleReadings: e.nozzleReadings || e.nozzle_readings || [],
      tankReadings: e.tankReadings || e.tank_readings || [],
      prices: e.prices || {},
      createdAt: e.createdAt || e.created_at,
    }))

    allEntries.sort((a, b) =>
      (a.entryDate || '').localeCompare(b.entryDate || '') ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
    )

    // All entries for the selected date (could be multiple)
    const todayEntries = allEntries.filter(e => e.entryDate === date)

    // Find the last entry before this date (for opening values of first entry)
    let prevDayEntry = null
    for (let i = allEntries.length - 1; i >= 0; i--) {
      if (allEntries[i].entryDate < date) {
        prevDayEntry = allEntries[i]
        break
      }
    }

    // Debug: log data state
    console.log('[Report Debug]', {
      selectedDate: date,
      totalEntriesInDB: allEntries.length,
      entriesForDate: todayEntries.length,
      prevDayEntry: prevDayEntry ? { entryDate: prevDayEntry.entryDate, id: prevDayEntry.id } : null,
      allDates: [...new Set(allEntries.map(e => e.entryDate))].sort(),
      sampleEntry: todayEntries[0] ? {
        id: todayEntries[0].id,
        entryDate: todayEntries[0].entryDate,
        hasNozzleReadings: !!(todayEntries[0].nozzleReadings || todayEntries[0].nozzle_readings),
        nozzleReadingsKey: todayEntries[0].nozzleReadings ? 'nozzleReadings' : todayEntries[0].nozzle_readings ? 'nozzle_readings' : 'none',
        prices: todayEntries[0].prices,
      } : null,
    })

    // Force fuel type order: PMS first, then AGO, then DPK
    const fuelTypes = ['PMS', 'AGO', 'DPK'].filter(ft => nozzles.some(n => n.fuel_type === ft))

    // Build per-entry groups — each entry gets its own nozzle rows
    const entryGroups = []
    const dayFuelTotals = {}
    for (const ft of fuelTypes) {
      dayFuelTotals[ft] = { dispensed: 0, consumed: 0, actual: 0, price: 0, amount: 0, pourBack: 0 }
    }

    for (let eIdx = 0; eIdx < todayEntries.length; eIdx++) {
      const currentEntry = todayEntries[eIdx]
      // All entries on the same day use previous DAY's last closing as opening (not chained)
      const prevEntry = prevDayEntry

      const nozzleRows = []
      const entryFuelTotals = {}

      for (const ft of fuelTypes) {
        const ftNozzles = nozzles.filter(n => n.fuel_type === ft).sort((a, b) => Number(a.pump_number) - Number(b.pump_number))
        let ftDispensed = 0
        let ftConsumed = 0
        let ftActual = 0
        let price = Number(currentEntry.prices?.[ft]) || 0

        const rows = ftNozzles.map(n => {
          const currentReadings = currentEntry.nozzleReadings || []
          const currentR = currentReadings.find(r => r.pump_id === n.id)

          const prevReadings = prevEntry?.nozzleReadings || []
          const prevR = prevReadings.find(r => r.pump_id === n.id)
          const opening = prevR ? Number(prevR.closing_meter || 0) : Number(n.initial_reading || 0)
          const closing = currentR ? Number(currentR.closing_meter || 0) : opening
          const consumption = currentR ? Number(currentR.consumption || 0) : 0
          const pourBack = currentR ? Number(currentR.pour_back || 0) : 0
          const dispensed = closing - opening
          const actual = dispensed - consumption - pourBack

          ftDispensed += dispensed
          ftConsumed += consumption
          ftActual += actual

          return { label: `${ft} ${n.pump_number}`, opening, closing, dispensed, consumption, actual, pourBack }
        })

        const ftAmount = ftActual * price

        entryFuelTotals[ft] = {
          dispensed: ftDispensed, consumed: ftConsumed, actual: ftActual,
          price, amount: ftAmount,
          pourBack: rows.reduce((s, r) => s + r.pourBack, 0),
        }

        // Accumulate day totals
        dayFuelTotals[ft].dispensed += ftDispensed
        dayFuelTotals[ft].consumed += ftConsumed
        dayFuelTotals[ft].actual += ftActual
        dayFuelTotals[ft].pourBack += entryFuelTotals[ft].pourBack
        dayFuelTotals[ft].price = price // use latest price
        dayFuelTotals[ft].amount += ftAmount

        nozzleRows.push({ fuelType: ft, rows, totals: entryFuelTotals[ft] })
      }

      entryGroups.push({ entryIndex: eIdx + 1, nozzleRows, fuelTotals: entryFuelTotals })
    }

    // If no entries for this date, build a single empty group with carried-forward values
    if (todayEntries.length === 0) {
      const nozzleRows = []
      for (const ft of fuelTypes) {
        const ftNozzles = nozzles.filter(n => n.fuel_type === ft).sort((a, b) => Number(a.pump_number) - Number(b.pump_number))
        const rows = ftNozzles.map(n => {
          const prevReadings = prevDayEntry?.nozzleReadings || []
          const prevR = prevReadings.find(r => r.pump_id === n.id)
          const opening = prevR ? Number(prevR.closing_meter || 0) : Number(n.initial_reading || 0)
          return { label: `${ft} ${n.pump_number}`, opening, closing: opening, dispensed: 0, consumption: 0, actual: 0, pourBack: 0 }
        })
        const totals = { dispensed: 0, consumed: 0, actual: 0, price: 0, amount: 0, pourBack: 0 }
        nozzleRows.push({ fuelType: ft, rows, totals })
      }
      entryGroups.push({ entryIndex: 1, nozzleRows, fuelTotals: Object.fromEntries(fuelTypes.map(ft => [ft, { dispensed: 0, consumed: 0, actual: 0, price: 0, amount: 0, pourBack: 0 }])) })
    }

    // Build tank rows — day-level (opening from prev day, closing from last entry)
    const lastEntry = todayEntries.length > 0 ? todayEntries[todayEntries.length - 1] : null
    const tanksByFuel = {}

    for (const ft of fuelTypes) {
      const ftTanks = tanks.filter(t => t.fuel_type === ft).sort((a, b) => Number(a.tank_number) - Number(b.tank_number))
      tanksByFuel[ft] = { tanks: [], totalOpening: 0, totalClosing: 0, totalWaybill: 0, totalActualSupply: 0 }

      for (const t of ftTanks) {
        const prevTankReadings = prevDayEntry?.tankReadings || []
        const prevTR = prevTankReadings.find(r => r.tank_id === t.id)
        const opening = prevTR ? Number(prevTR.closing_stock || 0) : Number(t.opening_stock || 0)

        const lastTankReadings = lastEntry?.tankReadings || []
        const lastTR = lastTankReadings.find(r => r.tank_id === t.id)
        const closing = lastTR ? Number(lastTR.closing_stock || 0) : opening

        tanksByFuel[ft].totalOpening += opening
        tanksByFuel[ft].totalClosing += closing
        tanksByFuel[ft].tanks.push({ label: `${ft} ${t.tank_number}`, opening, closing })
      }
    }

    // Get product receipts for this date (waybill supply)
    const allReceipts = await db.productReceipts
      .where('orgId').equals(orgId)
      .toArray()
    const todayReceipts = allReceipts.filter(r => r.entryDate === date)

    for (const receipt of todayReceipts) {
      const tankConfig = tanks.find(t => t.id === receipt.tankId)
      if (tankConfig && tanksByFuel[tankConfig.fuel_type]) {
        const waybill = Number(receipt.actualVolume) || 0
        tanksByFuel[tankConfig.fuel_type].totalWaybill += waybill
        tanksByFuel[tankConfig.fuel_type].totalActualSupply += waybill
      }
    }

    // OV/SH = Actual Closing - Expected Closing
    // Expected Closing = Opening + Supply - Dispensed
    // OV/SH = Closing - (Opening + Supply - Dispensed) = Closing - Opening - Supply + Dispensed
    // Positive = overage, Negative = shortage
    const tankSummaryRows = fuelTypes.map(ft => {
      const tb = tanksByFuel[ft]
      const dispensed = dayFuelTotals[ft].dispensed
      return {
        fuelType: ft, tanks: tb.tanks,
        opening: tb.totalOpening, waybillSupply: tb.totalWaybill,
        actualSupply: tb.totalActualSupply, closing: tb.totalClosing,
        dispensed,
        ovsh: (tb.totalClosing - tb.totalOpening) - tb.totalActualSupply + dispensed,
      }
    })

    // Get lodgements matching this salesDate
    const allLodgements = await db.lodgements
      .where('orgId').equals(orgId)
      .toArray()
    const todayLodgements = allLodgements.filter(l => l.salesDate === date)

    const posEntries = []
    const bankMap = {}
    for (const b of banks) { bankMap[b.id] = b }
    for (const l of todayLodgements) {
      const bank = bankMap[l.bankId]
      posEntries.push({
        bankName: bank?.bank_name || 'Unknown',
        lodgementType: l.lodgementType || bank?.lodgement_type || '',
        amount: Number(l.amount) || 0,
      })
    }

    const totalPOS = posEntries
      .filter(p => p.lodgementType === 'pos')
      .reduce((s, p) => s + p.amount, 0)

    // Get consumption for this date
    const allConsumption = await db.consumption
      .where('orgId').equals(orgId)
      .toArray()
    const todayConsumption = allConsumption.filter(c => c.entryDate === date)

    // Summary — aggregate across all entries
    const totalSales = fuelTypes.reduce((s, ft) => s + dayFuelTotals[ft].amount, 0)
    const totalCash = totalSales - totalPOS

    setReport({
      entryGroups,
      dayFuelTotals,
      fuelTypes,
      tankSummaryRows,
      tanksByFuel,
      posEntries,
      totalPOS,
      todayConsumption,
      totalSales,
      totalCash,
      hasEntry: todayEntries.length > 0,
      entryCount: todayEntries.length,
    })
  }, [orgId, date, nozzles, tanks, banks])

  useEffect(() => {
    if (!loading) buildReport()
  }, [loading, buildReport])

  const changeDate = (delta) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="max-w-4xl px-4 sm:px-8 py-8">
        <p className="text-base text-gray-500">No station selected.</p>
      </div>
    )
  }

  const qs = `org_id=${orgId}`

  const hdr = 'bg-[#1F3864] text-white'
  const subHdr = 'bg-[#D6E4F0] text-[#1F3864]'
  const bdr = 'border border-[#8DB4E2]'
  const cell = `${bdr} px-2 py-1.5`
  const cellR = `${cell} text-right`

  return (
    <div className="max-w-[1200px] px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-lg font-bold text-gray-900">Daily Sales Operation Report</h1>
        <div className="flex items-center gap-2">
          {/* Edit entries dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowEditMenu(!showEditMenu)}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showEditMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 shadow-lg min-w-[200px]">
                  <Link href={`/dashboard/entries/daily-sales?${qs}`} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Daily Sales</Link>
                  <Link href={`/dashboard/entries/product-receipt?${qs}`} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Product Receipt</Link>
                  <Link href={`/dashboard/entries/lodgements?${qs}`} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Lodgements</Link>
                  <Link href={`/dashboard/entries/consumption?${qs}`} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Consumption</Link>
                </div>
              </>
            )}
          </div>
          <button onClick={() => changeDate(-1)} className="p-1.5 border border-gray-300 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => changeDate(1)} className="p-1.5 border border-gray-300 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!report?.hasEntry && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 mb-4 text-base text-yellow-800">
          No entry found for this date. Showing carried-forward values.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* ===== LEFT: DAILY SALES OPERATION ===== */}
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold whitespace-nowrap`}>Pumps</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Opening</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Closing</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Dispensed</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Consumed</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Actual</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Price</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {report?.entryGroups.map((group) => (
                  <EntryGroup
                    key={group.entryIndex}
                    group={group}
                    showHeader={report.entryCount > 1}
                    cell={cell}
                    cellR={cellR}
                    hdr={hdr}
                  />
                ))}
                {report?.entryCount > 1 && (
                  <tr className={`${hdr} font-bold`}>
                    <td className={cell}>DAY TOTAL</td>
                    <td className={cellR}></td>
                    <td className={cellR}></td>
                    <td className={cellR}>
                      {fmt(report.fuelTypes.reduce((s, ft) => s + report.dayFuelTotals[ft].dispensed, 0))}
                    </td>
                    <td className={cellR}>
                      {fmt(report.fuelTypes.reduce((s, ft) => s + report.dayFuelTotals[ft].consumed, 0))}
                    </td>
                    <td className={cellR}>
                      {fmt(report.fuelTypes.reduce((s, ft) => s + report.dayFuelTotals[ft].actual, 0))}
                    </td>
                    <td className={cellR}></td>
                    <td className={cellR}>
                      {fmt(report.fuelTypes.reduce((s, ft) => s + report.dayFuelTotals[ft].amount, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* ===== RIGHT: STOCK & SUMMARY ===== */}
        <div className="min-w-0">
          {/* Tank stock table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold whitespace-nowrap`}>Tank</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Opening</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Supply</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Closing</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>Dispensed</th>
                  <th className={`${cellR} font-bold whitespace-nowrap`}>OV/SH</th>
                </tr>
              </thead>
              <tbody>
                {report?.tankSummaryRows.map((row) => (
                  <TankRow key={row.fuelType} row={row} cell={cell} cellR={cellR} subHdr={subHdr} />
                ))}
              </tbody>
            </table>
          </div>

          {/* POS & Consumption side by side */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* POS */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {report?.posEntries.filter(p => p.lodgementType === 'pos').map((p, i) => (
                    <tr key={i}>
                      <td className={cell}>{p.bankName}</td>
                      <td className={cellR}>{fmt(p.amount)}</td>
                    </tr>
                  ))}
                  {(!report?.posEntries.filter(p => p.lodgementType === 'pos').length) && (
                    <tr><td colSpan={2} className={`${cell} text-gray-400`}>No POS entries</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Consumption */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {report?.todayConsumption.map((c, i) => (
                    <tr key={i}>
                      <td className={cell}>{c.fuelType || ''}</td>
                      <td className={cellR}>{fmt(c.quantity)}</td>
                    </tr>
                  ))}
                  {(!report?.todayConsumption?.length) && (
                    <tr><td colSpan={2} className={`${cell} text-gray-400`}>No consumption</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={subHdr}>
                <th className={`${cell} text-left font-bold`}></th>
                <th className={`${cellR} font-bold`}>P/b</th>
                <th className={`${cellR} font-bold`}>Sales</th>
                <th className={`${cellR} font-bold`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {report?.fuelTypes.map(ft => (
                <tr key={ft}>
                  <td className={`${cell} font-bold`}>{ft}</td>
                  <td className={cellR}>{fmt(report.dayFuelTotals[ft]?.pourBack)}</td>
                  <td className={cellR}>{fmt(report.dayFuelTotals[ft]?.actual)}</td>
                  <td className={cellR}>{fmt(report.dayFuelTotals[ft]?.amount)}</td>
                </tr>
              ))}
              <tr className={`${subHdr} font-bold`}>
                <td colSpan={3} className={cell}>SALES</td>
                <td className={cellR}>{fmt(report?.totalSales)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className={cell}>POS</td>
                <td className={cellR}>{fmt(report?.totalPOS)}</td>
              </tr>
              <tr className={`${subHdr} font-bold`}>
                <td colSpan={3} className={cell}>CASH</td>
                <td className={cellR}>{fmt(report?.totalCash)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Renders all fuel groups for a single entry */
function EntryGroup({ group, showHeader, cell, cellR, hdr }) {
  return (
    <>
      {showHeader && (
        <tr className={hdr}>
          <td colSpan={8} className={`${cell} font-bold`}>
            Entry {group.entryIndex}
          </td>
        </tr>
      )}
      {group.nozzleRows.map(({ fuelType, rows, totals }) => (
        <FuelGroup key={fuelType} rows={rows} totals={totals} cell={cell} cellR={cellR} />
      ))}
    </>
  )
}

/** Renders a fuel type group (e.g. all PMS nozzles + subtotal row) */
function FuelGroup({ rows, totals, cell, cellR }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.label}>
          <td className={`${cell} font-bold whitespace-nowrap`}>{r.label}</td>
          <td className={cellR}>{fmt(r.opening)}</td>
          <td className={cellR}>{fmt(r.closing)}</td>
          <td className={cellR}>{fmt(r.dispensed)}</td>
          <td className={cellR}>{fmt(r.consumption)}</td>
          <td className={cellR}></td>
          <td className={cellR}></td>
          <td className={cellR}></td>
        </tr>
      ))}
      {/* Subtotal row */}
      <tr className="bg-[#D6E4F0] font-bold">
        <td className={cell}></td>
        <td className={cellR}></td>
        <td className={cellR}></td>
        <td className={cellR}>{fmt(totals.dispensed)}</td>
        <td className={cellR}>{fmt(totals.consumed)}</td>
        <td className={cellR}>{fmt(totals.actual)}</td>
        <td className={cellR}>{fmt(totals.price)}</td>
        <td className={cellR}>{fmt(totals.amount)}</td>
      </tr>
    </>
  )
}

/** Renders tank summary rows for a fuel type */
function TankRow({ row, cell, cellR, subHdr }) {
  const ovshColor = row.ovsh < 0 ? 'text-red-600' : row.ovsh > 0 ? 'text-green-600' : ''

  return (
    <>
      {row.tanks.length > 1 ? (
        <>
          {row.tanks.map((t) => (
            <tr key={t.label}>
              <td className={`${cell} font-bold whitespace-nowrap`}>{t.label}</td>
              <td className={cellR}>{fmt(t.opening)}</td>
              <td className={cellR}></td>
              <td className={cellR}>{fmt(t.closing)}</td>
              <td className={cellR}></td>
              <td className={cellR}></td>
            </tr>
          ))}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Total</td>
            <td className={cellR}>{fmt(row.opening)}</td>
            <td className={cellR}>{fmt(row.actualSupply)}</td>
            <td className={cellR}>{fmt(row.closing)}</td>
            <td className={cellR}>{fmt(row.dispensed)}</td>
            <td className={`${cellR} ${ovshColor}`}>
              {row.ovsh > 0 ? '+' : ''}{fmt(row.ovsh)}
            </td>
          </tr>
        </>
      ) : (
        <tr>
          <td className={`${cell} font-bold whitespace-nowrap`}>{row.fuelType}</td>
          <td className={cellR}>{fmt(row.opening)}</td>
          <td className={cellR}>{fmt(row.actualSupply)}</td>
          <td className={cellR}>{fmt(row.closing)}</td>
          <td className={cellR}>{fmt(row.dispensed)}</td>
          <td className={`${cellR} font-bold ${ovshColor}`}>
            {row.ovsh > 0 ? '+' : ''}{fmt(row.ovsh)}
          </td>
        </tr>
      )}
    </>
  )
}
