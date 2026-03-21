'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { buildDailyReport } from '@/lib/buildDailyReport'
import DateInput from '@/components/DateInput'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <SummaryContent />
    </Suspense>
  )
}

function SummaryContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [startDate, _setStartDate] = useState(monthStartStr)
  const [endDate, _setEndDate] = useState(todayStr)
  const startDateRef = useRef(monthStartStr)
  const endDateRef = useRef(todayStr)
  const setStartDate = (v) => { startDateRef.current = v; _setStartDate(v) }
  const setEndDate = (v) => { endDateRef.current = v; _setEndDate(v) }
  const [viewDate, setViewDate] = useState(todayStr)
  const [generated, setGenerated] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
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

  // Live queries
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
  const liveCustomers = useLiveQuery(
    () => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const customerMap = useMemo(() => {
    if (!liveCustomers) return {}
    return Object.fromEntries(liveCustomers.map(c => [c.id, c.name || 'Unknown']))
  }, [liveCustomers])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements) return null
    return buildDailyReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      nozzles,
      tanks,
      banks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, liveSales, liveReceipts, liveLodgements])

  // Current day index and report
  const dayIndex = useMemo(() => {
    if (!report?.dateReports?.length) return -1
    const idx = report.dateReports.findIndex(r => r.date === viewDate)
    return idx >= 0 ? idx : report.dateReports.length - 1
  }, [report, viewDate])

  const dayReport = report?.dateReports?.[dayIndex] || null
  const totalDays = report?.dateReports?.length || 0

  const goPrev = () => {
    if (!report?.dateReports || dayIndex <= 0) return
    setViewDate(report.dateReports[dayIndex - 1].date)
  }
  const goNext = () => {
    if (!report?.dateReports || dayIndex >= totalDays - 1) return
    setViewDate(report.dateReports[dayIndex + 1].date)
  }

  // Clamp viewDate when range changes
  useEffect(() => {
    if (!reportStart || !reportEnd) return
    if (viewDate < reportStart || viewDate > reportEnd) setViewDate(reportEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStart, reportEnd])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    setGenerating(true)
    setTimeout(() => {
      setReportStart(s)
      setReportEnd(e)
      setGenerated(true)
      setGenerating(false)
    }, 2000)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  if (!orgId) {
    return <div className="max-w-4xl px-4 sm:px-8 py-8"><p className="text-base text-gray-500">No station selected.</p></div>
  }

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1 py-0.5`
  const cellR = `${cell} text-right`

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-2 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-end py-3 shrink-0">
        <div className="flex items-center gap-2">
          <DateInput
            value={startDate}
            onChange={setStartDate}
            className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-400">to</span>
          <DateInput
            value={endDate}
            onChange={setEndDate}
            className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !startDate || !endDate || startDate > endDate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {generating && <Loader2 className="w-4 h-4 animate-spin" />}
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Day navigation */}
      {report && totalDays > 1 && dayReport && (
        <div className="flex items-center justify-between shrink-0 mb-2 px-1 sm:px-[15%]">
          <button
            onClick={goPrev}
            disabled={dayIndex <= 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-gray-600 font-medium">
            {new Date(dayReport.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            <span className="text-gray-400 ml-1">({dayIndex + 1} of {totalDays})</span>
          </span>
          <button
            onClick={goNext}
            disabled={dayIndex >= totalDays - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      {!generated ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
        </div>
      ) : !report ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !dayReport ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No data for this period.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 border border-gray-200 px-1 sm:px-[15%]">
          {/* 1. Closing Meter Readings per entry */}
          {dayReport.entryGroups.map((group, groupIdx) => (
            <div key={group.entryIndex} className="mb-4">
              {dayReport.entryCount > 1 && (
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <tr className={hdr}>
                      <td className={cell} colSpan={3}>Entry {group.entryIndex}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Closing readings grouped by fuel */}
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {report.fuelTypes.map(ft => {
                    const fuelGroup = group.nozzleRows.find(nr => nr.fuelType === ft)
                    if (!fuelGroup) return null
                    const isLastGroup = groupIdx === dayReport.entryGroups.length - 1
                    return (
                      <ClosingReadings
                        key={ft}
                        fuelType={ft}
                        rows={fuelGroup.rows}
                        totals={fuelGroup.totals}
                        dayTotals={isLastGroup ? dayReport.dayFuelTotals[ft] : null}
                        cell={cell}
                        cellR={cellR}
                        subHdr={subHdr}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* 2. Consumption table */}
          {dayReport.consumption.entries.length > 0 && (
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold`}>Account</th>
                  <th className={`${cell} text-left font-bold`}>Fuel</th>
                  <th className={`${cellR} font-bold`}>Qty</th>
                  <th className={`${cell} text-center font-bold`}>Type</th>
                </tr>
              </thead>
              <tbody>
                {dayReport.consumption.entries.map((c, i) => (
                  <tr key={i}>
                    <td className={cell}>{customerMap[c.customerId] || 'Unknown'}</td>
                    <td className={cell}>{c.fuelType || ''}</td>
                    <td className={cellR}>{fmt(c.quantity)}</td>
                    <td className={`${cell} text-center`}>{c.isPourBack ? 'Pour Back' : 'Consumption'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 3. Lodgements */}
          <table className="w-full border-collapse text-sm mb-4">
            <thead>
              <tr className={subHdr}>
                <th className={`${cell} text-left font-bold`}>Lodgements</th>
                <th className={`${cellR} font-bold`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {dayReport.lodgement.bankRows.filter(r => r.deposited > 0).map(row => (
                <tr key={row.bankId}>
                  <td className={cell}>
                    <span className="font-bold">{row.bankName}{row.terminalId ? ` - ${row.terminalId}` : ''}</span>
                    <span className="text-xs text-gray-400 ml-1">({row.lodgementType === 'bank_deposit' ? 'deposit' : row.lodgementType})</span>
                  </td>
                  <td className={cellR}>{fmt(row.deposited)}</td>
                </tr>
              ))}
              {dayReport.lodgement.totalAll === 0 && (
                <tr><td colSpan={2} className={`${cell} text-gray-400`}>No lodgements</td></tr>
              )}
              {dayReport.lodgement.totalAll > 0 && (
                <tr className={`${subHdr} font-bold`}>
                  <td className={cell}>Total Lodged</td>
                  <td className={cellR}>{fmt(dayReport.lodgement.totalAll)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* 4. Product Received */}
          {report.fuelTypes.some(ft => (dayReport.tanksByFuel?.[ft]?.totalSupply || 0) > 0) && (
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold`}>Product Received</th>
                  <th className={`${cellR} font-bold`}>Volume</th>
                </tr>
              </thead>
              <tbody>
                {report.fuelTypes.map(ft => {
                  const supply = dayReport.tanksByFuel?.[ft]?.totalSupply || 0
                  if (!supply) return null
                  return (
                    <tr key={ft}>
                      <td className={`${cell} font-bold`}>{ft}</td>
                      <td className={cellR}>{fmt(supply)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* 5. Sales */}
          <table className="w-full border-collapse text-sm mb-4">
            <thead>
              <tr className={subHdr}>
                <th className={`${cell} text-left font-bold`}></th>
                <th className={`${cellR} font-bold`}>Sales</th>
                <th className={`${cellR} font-bold`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {report.fuelTypes.map(ft => (
                <tr key={ft}>
                  <td className={`${cell} font-bold`}>{ft}</td>
                  <td className={cellR}>{fmt(dayReport.dayFuelTotals[ft]?.actual)}</td>
                  <td className={cellR}>{fmt(dayReport.dayFuelTotals[ft]?.amount)}</td>
                </tr>
              ))}
              <tr className={`${subHdr} font-bold`}>
                <td colSpan={2} className={cell}>SALES</td>
                <td className={cellR}>{fmt(dayReport.totalSales)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={2} className={cell}>TOTAL POS</td>
                <td className={cellR}>{fmt(dayReport.lodgement.totalPOS)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={2} className={cell}>TOTAL TRANSFER</td>
                <td className={cellR}>{fmt(dayReport.lodgement.totalTransfer)}</td>
              </tr>
              <tr className={`${subHdr} font-bold`}>
                <td colSpan={2} className={cell}>CASH</td>
                <td className={cellR}>{fmt(dayReport.cashBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Renders closing meter readings for one fuel type + dispensed minus consumed */
function ClosingReadings({ fuelType, rows, totals, dayTotals, cell, cellR, subHdr }) {
  // Use day-level totals from consumption_entries when available (last entry group)
  const src = dayTotals || totals
  const dispensed = src.dispensed
  const consumed = src.consumed || 0
  const pourBack = src.pourBack || 0
  const adjustment = consumed + pourBack
  const actual = src.actual

  return (
    <>
      <tr className={subHdr}>
        <td className={`${cell} font-bold`} colSpan={2}>{fuelType}</td>
      </tr>
      {rows.map((r, i) => (
        <tr key={r.label}>
          <td className={`${cell} font-bold`}>{fuelType} {i + 1}</td>
          <td className={cellR}>{fmt(r.closing)}</td>
        </tr>
      ))}
      {dayTotals ? (
        <tr className="bg-gray-50 font-bold">
          <td className={cell} colSpan={2}>
            {fmt(dispensed)} &minus; {fmt(adjustment)} = {fmt(actual)}
          </td>
        </tr>
      ) : (
        <tr className="bg-gray-50 font-bold">
          <td className={cell} colSpan={2}>
            Dispensed: {fmt(totals.dispensed)}
          </td>
        </tr>
      )}
    </>
  )
}
