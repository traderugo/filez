'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Pencil } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { initialSync } from '@/lib/initialSync'
import { buildDailyReport } from '@/lib/buildDailyReport'

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
  const [generated, setGenerated] = useState(true)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  const [showEditMenu, setShowEditMenu] = useState(false)
  const [tabOffset, setTabOffset] = useState(0)
  const TAB_COUNT = 31

  // Initial sync + config load (one-time)
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

  // Live queries — auto-rebuild report when entries change in IndexedDB
  const liveSales = useLiveQuery(
    () => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLodgements = useLiveQuery(
    () => orgId ? db.lodgements.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveConsumption = useLiveQuery(
    () => orgId ? db.consumption.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveCustomers = useLiveQuery(
    () => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const customerMap = useMemo(() => {
    if (!liveCustomers) return {}
    return Object.fromEntries(liveCustomers.map(c => [c.id, c.name || 'Unknown']))
  }, [liveCustomers])

  // Derive report synchronously — only recalculates after Generate is clicked
  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements || !liveConsumption) return null

    return buildDailyReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      consumption: liveConsumption,
      nozzles,
      tanks,
      banks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, liveSales, liveReceipts, liveLodgements, liveConsumption])

  const handleGenerate = () => {
    if (!startDate || !endDate) return
    setReportStart(startDate)
    setReportEnd(endDate)
    setGenerated(true)
  }

  // Clamp viewDate and reset tab offset when committed range changes
  useEffect(() => {
    if (!reportStart || !reportEnd) return
    setTabOffset(0)
    if (viewDate < reportStart) setViewDate(reportStart)
    else if (viewDate > reportEnd) setViewDate(reportEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStart, reportEnd])

  // Detect dates with duplicate COB entries (multiple COB per date causes calculation issues)
  const duplicateDates = useMemo(() => {
    if (!liveSales) return []
    const cobCountByDate = {}
    for (const e of liveSales) {
      if (!e.closeOfBusiness && !e.close_of_business) continue
      const d = e.entryDate || e.entry_date
      cobCountByDate[d] = (cobCountByDate[d] || 0) + 1
    }
    return Object.entries(cobCountByDate).filter(([, c]) => c > 1).map(([d]) => d)
  }, [liveSales])

  // Auto-scroll tabs so active day is always visible
  useEffect(() => {
    if (!report?.dateReports) return
    const idx = report.dateReports.findIndex(r => r.date === viewDate)
    if (idx < tabOffset) setTabOffset(idx)
    else if (idx >= tabOffset + TAB_COUNT) setTabOffset(idx - TAB_COUNT + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1 py-0.5`
  const cellR = `${cell} text-right`

  const currentDayReport = report?.dateReports.find(r => r.date === viewDate) || null
  const currentDayHasDuplicates = duplicateDates.includes(viewDate)

  return (
    <div className="flex flex-col h-[calc(95vh-4rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Duplicate entry warning */}
      {currentDayHasDuplicates && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 text-sm mb-1 shrink-0">
          <span className="font-bold">Warning:</span> Multiple entries exist for {viewDate}. This may cause incorrect calculations. Please delete the duplicate from the <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="underline font-medium">entries list</Link>.
        </div>
      )}
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
            {showEditMenu && (() => {
              const dailySalesId = currentDayReport?.entryGroups?.[0]?.entryId
              const ids = currentDayReport?.editIds || {}
              const link = (type, id) => id ? `/dashboard/entries/${type}?${qs}&edit=${id}` : `/dashboard/entries/${type}?${qs}`
              return (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 shadow-lg min-w-[200px]">
                    <Link href={link('daily-sales', dailySalesId)} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Daily Sales</Link>
                    <Link href={link('product-receipt', ids.receipt)} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Product Receipt</Link>
                    <Link href={link('lodgements', ids.lodgement)} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Lodgements</Link>
                    <Link href={link('consumption', ids.consumption)} onClick={() => setShowEditMenu(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600">Consumption</Link>
                  </div>
                </>
              )
            })()}
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
          <button
            onClick={handleGenerate}
            disabled={!startDate || !endDate || startDate > endDate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      {!generated ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
        </div>
      ) : !report ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : currentDayReport && (
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 border border-gray-200">

          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 pb-4 min-w-[700px]">
            {/* ===== LEFT: DAILY SALES OPERATION ===== */}
            <div className="min-w-0">
              <div>
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
              <div>
                <table className="w-full border-collapse text-sm mb-4">
                  <thead>
                    <tr className={subHdr}>
                      <th className={`${cell} text-left font-bold whitespace-nowrap`}>Tank</th>
                      <th className={`${cellR} font-bold whitespace-nowrap`}>Opening</th>
                      <th className={`${cellR} font-bold whitespace-nowrap`}>Supply</th>
                      <th className={`${cellR} font-bold whitespace-nowrap`}>Closing</th>
                      <th className={`${cellR} font-bold whitespace-nowrap`}>Diff</th>
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

              {/* Lodgements table */}
              <table className="w-full border-collapse text-sm mb-4">
                <thead>
                  <tr className={subHdr}>
                    <th className={`${cell} text-left font-bold whitespace-nowrap`}>Account</th>
                    <th className={`${cellR} font-bold whitespace-nowrap`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDayReport.lodgement.bankRows.filter(r => r.deposited > 0).map(row => (
                    <tr key={row.bankId}>
                      <td className={`${cell} whitespace-nowrap`}>
                        <span className="font-bold">{row.bankName}{row.terminalId ? ` - ${row.terminalId}` : ''}</span>
                        <span className="text-xs text-gray-400 ml-1">({row.lodgementType === 'bank_deposit' ? 'deposit' : row.lodgementType})</span>
                      </td>
                      <td className={cellR}>{fmt(row.deposited)}</td>
                    </tr>
                  ))}
                  {currentDayReport.lodgement.totalAll === 0 && (
                    <tr><td colSpan={2} className={`${cell} text-gray-400`}>No lodgements</td></tr>
                  )}
                  {currentDayReport.lodgement.totalAll > 0 && (
                    <tr className={`${subHdr} font-bold`}>
                      <td className={cell}>Total Lodged</td>
                      <td className={cellR}>{fmt(currentDayReport.lodgement.totalAll)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Consumption & Pour Back entries */}
              {currentDayReport.consumption.entries.length > 0 && (
                <table className="w-full border-collapse text-sm mb-2">
                  <thead>
                    <tr className={subHdr}>
                      <th className={`${cell} text-left font-bold`}>Account</th>
                      <th className={`${cell} text-left font-bold`}>Fuel</th>
                      <th className={`${cellR} font-bold`}>Qty</th>
                      <th className={`${cell} text-center font-bold`}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDayReport.consumption.entries.map((c, i) => (
                      <tr key={i}>
                        <td className={cell}>{customerMap[c.customerId] || 'Unknown'}</td>
                        <td className={cell}>{c.fuelType || ''}</td>
                        <td className={cellR}>{fmt(c.quantity)}</td>
                        <td className={`${cell} text-center text-xs`}>{c.isPourBack ? 'Pour Back' : 'Consumption'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Consumption comparison notice */}
              {(() => {
                const cmp = currentDayReport.consumptionComparison
                const hasMismatch = report.fuelTypes.some(ft => cmp[ft] && (!cmp[ft].consumedMatch || !cmp[ft].pourBackMatch))
                const hasAnyData = report.fuelTypes.some(ft => cmp[ft] && (cmp[ft].entryConsumed || cmp[ft].nozzleConsumed || cmp[ft].entryPourBack || cmp[ft].nozzlePourBack))
                if (!hasAnyData) return null
                return (
                  <div className={`text-xs px-3 py-2 mb-4 border rounded ${hasMismatch ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {report.fuelTypes.map(ft => {
                      const c = cmp[ft]
                      if (!c || (!c.entryConsumed && !c.nozzleConsumed && !c.entryPourBack && !c.nozzlePourBack)) return null
                      const parts = []
                      if (c.nozzleConsumed || c.entryConsumed) {
                        parts.push(
                          <span key={`${ft}-c`}>
                            <strong>{ft}</strong> consumption: {fmt(c.nozzleConsumed)}L dispensed vs {fmt(c.entryConsumed)}L entered
                            {!c.consumedMatch && <span className="font-bold text-red-600"> (mismatch)</span>}
                          </span>
                        )
                      }
                      if (c.nozzlePourBack || c.entryPourBack) {
                        parts.push(
                          <span key={`${ft}-p`}>
                            <strong>{ft}</strong> pour back: {fmt(c.nozzlePourBack)}L dispensed vs {fmt(c.entryPourBack)}L entered
                            {!c.pourBackMatch && <span className="font-bold text-red-600"> (mismatch)</span>}
                          </span>
                        )
                      }
                      return parts.map((p, i) => <div key={`${ft}-${i}`}>{p}</div>)
                    })}
                  </div>
                )
              })()}

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
                    <td className={cellR}>{fmt(currentDayReport.lodgement.totalPOS)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={3} className={cell}>Deposits</td>
                    <td className={cellR}>{fmt(currentDayReport.lodgement.totalDeposits)}</td>
                  </tr>
                  <tr className={`${subHdr} font-bold`}>
                    <td colSpan={3} className={cell}>CASH</td>
                    <td className={cellR}>{fmt(currentDayReport.cashBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Day tabs — fixed at bottom */}
      {generated && report?.dateReports && (
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
                  className={`px-2 py-1.5 text-sm font-medium border-r border-blue-200 shrink-0 ${isActive ? 'bg-blue-600 text-white' : dr.hasEntry ? 'bg-white text-blue-600' : 'bg-gray-50 text-gray-400'}`}
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
                    className={`px-2 py-1.5 text-sm font-medium border-r border-blue-200 ${isActive ? 'bg-blue-600 text-white' : dr.hasEntry ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
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
  const totalOvshColor = row.totalOvsh < 0 ? 'text-red-600' : row.totalOvsh > 0 ? 'text-green-600' : ''

  return (
    <>
      {row.tanks.map((t) => {
        const ovshColor = t.ovsh < 0 ? 'text-red-600' : t.ovsh > 0 ? 'text-green-600' : ''
        return (
          <tr key={t.label}>
            <td className={`${cell} font-bold whitespace-nowrap`}>{t.label}</td>
            <td className={cellR}>{fmt(t.opening)}</td>
            <td className={cellR}>{t.supply ? fmt(t.supply) : ''}</td>
            <td className={cellR}>{fmt(t.closing)}</td>
            <td className={cellR}>{fmt(t.diff)}</td>
            <td className={cellR}>{fmt(t.dispensed)}</td>
            <td className={`${cellR} ${ovshColor}`}>
              {t.ovsh > 0 ? '+' : ''}{fmt(t.ovsh)}
            </td>
          </tr>
        )
      })}
      {row.tanks.length > 1 && (
        <tr className={`${subHdr} font-bold`}>
          <td className={cell}>Total</td>
          <td className={cellR}>{fmt(row.totalOpening)}</td>
          <td className={cellR}>{row.totalSupply ? fmt(row.totalSupply) : ''}</td>
          <td className={cellR}>{fmt(row.totalClosing)}</td>
          <td className={cellR}>{fmt(row.totalDiff)}</td>
          <td className={cellR}>{fmt(row.totalDispensed)}</td>
          <td className={`${cellR} ${totalOvshColor}`}>
            {row.totalOvsh > 0 ? '+' : ''}{fmt(row.totalOvsh)}
          </td>
        </tr>
      )}
    </>
  )
}
