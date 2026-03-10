'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Pencil } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { initialSync } from '@/lib/initialSync'
import { calculateDateRangeNozzles } from '@/lib/salesCalculations'

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
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [viewDate, setViewDate] = useState(todayStr)

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  // Report data
  const [report, setReport] = useState(null)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [tabOffset, setTabOffset] = useState(0)
  const TAB_COUNT = 31

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

      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
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

    // Get all daily sales entries
    const rawEntries = await db.dailySales
      .where('orgId').equals(orgId)
      .toArray()

    const allEntries = rawEntries.map(e => ({
      ...e,
      entryDate: e.entryDate || e.entry_date,
      nozzleReadings: e.nozzleReadings || e.nozzle_readings || [],
      tankReadings: e.tankReadings || e.tank_readings || [],
      prices: e.prices || {},
      createdAt: e.createdAt || e.created_at,
    }))

    const sorted = [...allEntries].sort((a, b) =>
      (a.entryDate || '').localeCompare(b.entryDate || '') ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
    )

    // Debug: log entries per date
    const dateMap = {}
    for (const e of allEntries) {
      if (!dateMap[e.entryDate]) dateMap[e.entryDate] = 0
      dateMap[e.entryDate]++
    }
    console.log('[Report] entries per date:', dateMap, 'total:', allEntries.length)

    // Use range helper for nozzle dispensed calculations
    const rangeResult = calculateDateRangeNozzles(allEntries, nozzles, startDate, endDate)
    const { fuelTypes } = rangeResult

    // Fetch auxiliary data once
    const [allReceipts, allLodgements, allConsumption] = await Promise.all([
      db.productReceipts.where('orgId').equals(orgId).toArray(),
      db.lodgements.where('orgId').equals(orgId).toArray(),
      db.consumption.where('orgId').equals(orgId).toArray(),
    ])
    const bankMap = {}
    for (const b of banks) { bankMap[b.id] = b }

    // Build per-date report
    const dateReports = rangeResult.dates.map(({ date, entries: helperEntries, dayTotals: helperDayTotals, hasEntry, entryCount }) => {
      const dateEntries = sorted.filter(e => e.entryDate === date)

      // Layer consumption/price/amount on top of helper output
      const entryGroups = []
      const dayFuelTotals = {}
      for (const ft of fuelTypes) {
        dayFuelTotals[ft] = { dispensed: 0, consumed: 0, actual: 0, price: 0, amount: 0, pourBack: 0 }
      }

      // For no-entry days, carry forward prices from the last entry before this date
      let prevPrices = {}
      if (dateEntries.length === 0) {
        let prevEntry = null
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (sorted[i].entryDate < date) { prevEntry = sorted[i]; break }
        }
        if (prevEntry) prevPrices = prevEntry.prices || {}
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

        entryGroups.push({ entryIndex: helperEntry.entryIndex, nozzleRows, fuelTotals: entryFuelTotals })
      }

      // Tanks
      let prevDayEntry = null
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].entryDate < date) { prevDayEntry = sorted[i]; break }
      }
      const lastEntry = dateEntries.length > 0 ? dateEntries[dateEntries.length - 1] : null
      const tanksByFuel = {}

      for (const ft of fuelTypes) {
        const ftTanks = tanks.filter(t => t.fuel_type === ft).sort((a, b) => Number(a.tank_number) - Number(b.tank_number))
        tanksByFuel[ft] = { tanks: [], totalOpening: 0, totalClosing: 0, totalWaybill: 0, totalActualSupply: 0 }

        for (const t of ftTanks) {
          const prevTR = (prevDayEntry?.tankReadings || []).find(r => r.tank_id === t.id)
          const opening = prevTR ? Number(prevTR.closing_stock || 0) : Number(t.opening_stock || 0)
          const lastTR = (lastEntry?.tankReadings || []).find(r => r.tank_id === t.id)
          const closing = lastTR ? Number(lastTR.closing_stock || 0) : opening

          tanksByFuel[ft].totalOpening += opening
          tanksByFuel[ft].totalClosing += closing
          tanksByFuel[ft].tanks.push({ label: `${ft} ${t.tank_number}`, opening, closing })
        }
      }

      const dateReceipts = allReceipts.filter(r => r.entryDate === date)
      for (const receipt of dateReceipts) {
        const tankConfig = tanks.find(t => t.id === receipt.tankId)
        if (tankConfig && tanksByFuel[tankConfig.fuel_type]) {
          const waybill = Number(receipt.actualVolume) || 0
          tanksByFuel[tankConfig.fuel_type].totalWaybill += waybill
          tanksByFuel[tankConfig.fuel_type].totalActualSupply += waybill
        }
      }

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

      // Lodgements
      const dateLodgements = allLodgements.filter(l => l.salesDate === date)
      const posEntries = dateLodgements.map(l => {
        const bank = bankMap[l.bankId]
        return {
          bankName: bank?.bank_name || 'Unknown',
          lodgementType: l.lodgementType || bank?.lodgement_type || '',
          amount: Number(l.amount) || 0,
        }
      })
      const totalPOS = posEntries.filter(p => p.lodgementType === 'pos').reduce((s, p) => s + p.amount, 0)

      // Consumption
      const dateConsumption = allConsumption.filter(c => c.entryDate === date)

      // Summary
      const totalSales = fuelTypes.reduce((s, ft) => s + dayFuelTotals[ft].amount, 0)
      const totalCash = totalSales - totalPOS

      return {
        date,
        entryGroups,
        dayFuelTotals,
        tankSummaryRows,
        tanksByFuel,
        posEntries,
        totalPOS,
        todayConsumption: dateConsumption,
        totalSales,
        totalCash,
        hasEntry,
        entryCount,
      }
    })

    console.log('[Report] rangeResult dates:', rangeResult.dates.map(d => ({ date: d.date, entryCount: d.entryCount, hasEntry: d.hasEntry })))
    setReport({ dateReports, fuelTypes })
  }, [orgId, startDate, endDate, nozzles, tanks, banks])

  useEffect(() => {
    if (!loading) buildReport()
  }, [loading, buildReport])

  // Clamp viewDate and reset tab offset when range changes
  useEffect(() => {
    setTabOffset(0)
    if (viewDate < startDate) setViewDate(startDate)
    else if (viewDate > endDate) setViewDate(endDate)
  }, [startDate, endDate])

  // Auto-scroll tabs so active day is always visible
  useEffect(() => {
    if (!report?.dateReports) return
    const idx = report.dateReports.findIndex(r => r.date === viewDate)
    if (idx < tabOffset) setTabOffset(idx)
    else if (idx >= tabOffset + TAB_COUNT) setTabOffset(idx - TAB_COUNT + 1)
  }, [viewDate, report])

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

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-900'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1 py-0.5`
  const cellR = `${cell} text-right`

  const currentDayReport = report?.dateReports.find(r => r.date === viewDate) || null

  return (
    <div className="flex flex-col h-[calc(95vh-4rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header — fixed at top */}
      <div className="flex items-center justify-between py-3 gap-2 flex-wrap shrink-0">
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Scrollable content area */}
      {currentDayReport && (
        <div className="flex-1 overflow-y-auto min-h-0 mb-3">

          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 pb-4">
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
                    {currentDayReport.entryGroups.map((group) => (
                      <EntryGroup
                        key={group.entryIndex}
                        group={group}
                        showHeader={currentDayReport.entryCount > 1}
                        cell={cell}
                        cellR={cellR}
                        hdr={hdr}
                      />
                    ))}
                    {currentDayReport.entryCount > 1 && (
                      <tr className={`${hdr} font-bold`}>
                        <td className={cell}>DAY TOTAL</td>
                        <td className={cellR}></td>
                        <td className={cellR}></td>
                        <td className={cellR}>
                          {fmt(report.fuelTypes.reduce((s, ft) => s + currentDayReport.dayFuelTotals[ft].dispensed, 0))}
                        </td>
                        <td className={cellR}>
                          {fmt(report.fuelTypes.reduce((s, ft) => s + currentDayReport.dayFuelTotals[ft].consumed, 0))}
                        </td>
                        <td className={cellR}>
                          {fmt(report.fuelTypes.reduce((s, ft) => s + currentDayReport.dayFuelTotals[ft].actual, 0))}
                        </td>
                        <td className={cellR}></td>
                        <td className={cellR}>
                          {fmt(report.fuelTypes.reduce((s, ft) => s + currentDayReport.dayFuelTotals[ft].amount, 0))}
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
                    {currentDayReport.tankSummaryRows.map((row) => (
                      <TankRow key={row.fuelType} row={row} cell={cell} cellR={cellR} subHdr={subHdr} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* POS & Consumption side by side */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {currentDayReport.posEntries.filter(p => p.lodgementType === 'pos').map((p, i) => (
                        <tr key={i}>
                          <td className={cell}>{p.bankName}</td>
                          <td className={cellR}>{fmt(p.amount)}</td>
                        </tr>
                      ))}
                      {(!currentDayReport.posEntries.filter(p => p.lodgementType === 'pos').length) && (
                        <tr><td colSpan={2} className={`${cell} text-gray-400`}>No POS entries</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {currentDayReport.todayConsumption.map((c, i) => (
                        <tr key={i}>
                          <td className={cell}>{c.fuelType || ''}</td>
                          <td className={cellR}>{fmt(c.quantity)}</td>
                        </tr>
                      ))}
                      {(!currentDayReport.todayConsumption?.length) && (
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
                  {report.fuelTypes.map(ft => (
                    <tr key={ft}>
                      <td className={`${cell} font-bold`}>{ft}</td>
                      <td className={cellR}>{fmt(currentDayReport.dayFuelTotals[ft]?.pourBack)}</td>
                      <td className={cellR}>{fmt(currentDayReport.dayFuelTotals[ft]?.actual)}</td>
                      <td className={cellR}>{fmt(currentDayReport.dayFuelTotals[ft]?.amount)}</td>
                    </tr>
                  ))}
                  <tr className={`${subHdr} font-bold`}>
                    <td colSpan={3} className={cell}>SALES</td>
                    <td className={cellR}>{fmt(currentDayReport.totalSales)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={3} className={cell}>POS</td>
                    <td className={cellR}>{fmt(currentDayReport.totalPOS)}</td>
                  </tr>
                  <tr className={`${subHdr} font-bold`}>
                    <td colSpan={3} className={cell}>CASH</td>
                    <td className={cellR}>{fmt(currentDayReport.totalCash)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Day tabs — fixed at bottom */}
      {report?.dateReports && (
        <>
          {/* Mobile: touch-scrollable strip */}
          <div className="flex overflow-x-auto justify-center shrink-0 border-t border-blue-200 md:hidden">
            {report.dateReports.map(dr => {
              const d = new Date(dr.date + 'T00:00:00')
              const isActive = dr.date === viewDate
              return (
                <button
                  key={dr.date}
                  onClick={() => setViewDate(dr.date)}
                  className={`px-2 py-1.5 text-sm font-medium border-r border-blue-200 shrink-0 ${isActive ? 'bg-blue-600 text-white' : dr.hasEntry ? 'bg-white text-blue-900' : 'bg-gray-50 text-gray-400'}`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          {/* Desktop: arrow-controlled window */}
          <div className="hidden md:flex items-center justify-center shrink-0 border-t border-blue-200">
            <button
              onClick={() => setTabOffset(Math.max(0, tabOffset - 1))}
              disabled={tabOffset <= 0}
              className="p-1.5 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex overflow-hidden">
              {report.dateReports.slice(tabOffset, tabOffset + TAB_COUNT).map(dr => {
                const d = new Date(dr.date + 'T00:00:00')
                const isActive = dr.date === viewDate
                return (
                  <button
                    key={dr.date}
                    onClick={() => setViewDate(dr.date)}
                    className={`px-2 py-1.5 text-sm font-medium border-r border-blue-200 ${isActive ? 'bg-blue-600 text-white' : dr.hasEntry ? 'bg-white text-blue-900 hover:bg-blue-50' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setTabOffset(Math.min(report.dateReports.length - TAB_COUNT, tabOffset + 1))}
              disabled={tabOffset >= report.dateReports.length - TAB_COUNT}
              className="p-1.5 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
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
      <tr className="bg-blue-50 font-bold">
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
