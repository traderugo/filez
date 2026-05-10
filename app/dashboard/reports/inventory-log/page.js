'use client'

import { Suspense, useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { buildInventoryLogReport } from '@/lib/buildInventoryLogReport'
import { fmtDate } from '@/lib/formatDate'
import DateInput from '@/components/DateInput'
// TODO: re-enable gating
// import AccessGate from '@/components/AccessGate'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtSigned(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  if (v === 0) return '0'
  if (v < 0) return `(${fmt(Math.abs(v))})`
  return fmt(v)
}

export default function InventoryLogPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <InventoryLogContent />
    </Suspense>
  )
}

function InventoryLogContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])

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
  const [generated, setGenerated] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)
  const [activeFuel, setActiveFuel] = useState('PMS')

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      const [noz, tnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
      ])
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  const liveSales = useLiveQuery(
    () => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts) return null
    return buildInventoryLogReport({
      sales: liveSales,
      receipts: liveReceipts,
      nozzles,
      tanks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, liveSales, liveReceipts])

  // Snap activeFuel to first available fuel type when report becomes available
  useEffect(() => {
    if (report?.fuelTypes?.length && !report.fuelTypes.includes(activeFuel)) {
      setActiveFuel(report.fuelTypes[0])
    }
  }, [report, activeFuel])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    if (dateRangeDays > 32) {
      alert('Date range cannot exceed 32 days.')
      return
    }
    setGenerating(true)
    setTimeout(() => {
      setReportStart(s)
      setReportEnd(e)
      setGenerated(true)
      setGenerating(false)
    }, 300)
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

  return (
    // TODO: re-enable gating
    // <AccessGate orgId={orgId} pageKey="report-inventory-log">
      <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-end py-3 shrink-0">
          <div className="flex items-center gap-2">
            <DateInput value={startDate} onChange={setStartDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
            <span className="text-sm text-gray-400">to</span>
            <DateInput value={endDate} onChange={setEndDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
            <button
              onClick={handleGenerate}
              disabled={generating || !startDate || !endDate || startDate > endDate || dateRangeDays > 32}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generating && <Loader2 className="w-4 h-4 animate-spin" />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
        {dateRangeDays > 32 && (
          <p className="text-xs text-red-500 mt-1">Date range cannot exceed 32 days ({dateRangeDays} days selected).</p>
        )}

        {report ? (
          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 border border-gray-200">
            <div className="px-4 sm:px-8 py-4">
              {report.fuelTypes.length > 1 && (
                <div className="flex gap-1 mb-4">
                  {report.fuelTypes.map(ft => (
                    <button
                      key={ft}
                      onClick={() => setActiveFuel(ft)}
                      className={`px-4 py-1.5 text-sm font-medium border ${
                        activeFuel === ft
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              )}
              <InventoryTable
                report={report}
                activeFuel={activeFuel}
                startDate={reportStart}
                endDate={reportEnd}
              />
            </div>
          </div>
        ) : generated ? (
          <div className="flex-1 flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
          </div>
        )}
      </div>
    // </AccessGate>
  )
}

function InventoryTable({ report, activeFuel, startDate, endDate }) {
  const { rows, totals, tanksByFuel } = report
  const ftTanks = tanksByFuel[activeFuel] || []
  const t = totals[activeFuel] || {}

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1.5 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`

  const showTotalCol = ftTanks.length > 1
  const closingCols = ftTanks.length + (showTotalCol ? 1 : 0)
  const totalCols = 1 + closingCols + 7

  const ovshColor = (v) => {
    if (v == null || v === 0) return ''
    return v < 0 ? 'text-red-600' : 'text-green-600'
  }

  return (
    <div className="min-w-[1000px] pb-4">
      <h2 className="text-base font-bold text-gray-900 mb-2">
        Inventory Log — {activeFuel} — {fmtDate(startDate)} to {fmtDate(endDate)}
      </h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={totalCols} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              INVENTORY — {activeFuel}
            </th>
          </tr>
          <tr className={subHdr}>
            <th rowSpan={2} className={`${cell} font-bold`}>Date</th>
            <th colSpan={closingCols} className={`${cell} text-center font-bold`}>Closing Stock</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>Tank OV/SH</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>Actual OV/SH</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>Variance</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>UGT Dispensed</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>Expected Supply</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>Actual Supply</th>
            <th rowSpan={2} className={`${cellR} font-bold`}>Driver Shortage</th>
          </tr>
          <tr className={subHdr}>
            {ftTanks.map(t => (
              <th key={t.id} className={`${cellR} font-bold text-xs`}>{activeFuel} {t.tank_number}</th>
            ))}
            {showTotalCol && (
              <th className={`${cellR} font-bold text-xs`}>Total</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const f = row.fuels[activeFuel] || {}
            const tankByIdMap = {}
            for (const tk of (f.tanks || [])) tankByIdMap[tk.tankId] = tk
            return (
              <tr key={row.date} className={row.hasEntry ? '' : 'text-gray-400'}>
                <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
                {ftTanks.map(tk => (
                  <td key={tk.id} className={cellR}>{fmt(tankByIdMap[tk.id]?.closingStock)}</td>
                ))}
                {showTotalCol && (
                  <td className={cellR}>{fmt(f.totalClosing)}</td>
                )}
                <td className={`${cellR} ${ovshColor(f.tankOvsh)}`}>{fmtSigned(f.tankOvsh)}</td>
                <td className={`${cellR} ${ovshColor(f.actualOvsh)}`}>{fmtSigned(f.actualOvsh)}</td>
                <td className={`${cellR} ${ovshColor(f.variance)}`}>{fmtSigned(f.variance)}</td>
                <td className={cellR}>{fmt(f.ugtDispensed)}</td>
                <td className={cellR}>{fmt(f.expectedSupply)}</td>
                <td className={cellR}>{fmt(f.actualSupply)}</td>
                <td className={`${cellR} ${ovshColor(f.driverShortage)}`}>{fmtSigned(f.driverShortage)}</td>
              </tr>
            )
          })}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Total</td>
            {ftTanks.map(tk => (
              <td key={tk.id} className={cellR}></td>
            ))}
            {showTotalCol && (
              <td className={cellR}>{fmt(t.totalClosing)}</td>
            )}
            <td className={`${cellR} ${ovshColor(t.tankOvsh)}`}>{fmtSigned(t.tankOvsh)}</td>
            <td className={`${cellR} ${ovshColor(t.actualOvsh)}`}>{fmtSigned(t.actualOvsh)}</td>
            <td className={`${cellR} ${ovshColor(t.variance)}`}>{fmtSigned(t.variance)}</td>
            <td className={cellR}>{fmt(t.ugtDispensed)}</td>
            <td className={cellR}>{fmt(t.expectedSupply)}</td>
            <td className={cellR}>{fmt(t.actualSupply)}</td>
            <td className={`${cellR} ${ovshColor(t.driverShortage)}`}>{fmtSigned(t.driverShortage)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
