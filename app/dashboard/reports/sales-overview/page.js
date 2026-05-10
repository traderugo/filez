'use client'

import { Suspense, useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { buildSalesOverviewReport } from '@/lib/buildSalesOverviewReport'
import { fmtDate } from '@/lib/formatDate'
import DateInput from '@/components/DateInput'
import AccessGate from '@/components/AccessGate'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SalesOverviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <SalesOverviewContent />
    </Suspense>
  )
}

function SalesOverviewContent() {
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

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales) return null
    return buildSalesOverviewReport({
      sales: liveSales,
      nozzles,
      tanks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, liveSales])

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
    <AccessGate orgId={orgId} pageKey="report-sales-overview">
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
              <SalesTable report={report} startDate={reportStart} endDate={reportEnd} />
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
    </AccessGate>
  )
}

function SalesTable({ report, startDate, endDate }) {
  const { fuelTypes, rows, totals } = report

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1.5 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`

  const showPmsAvg = fuelTypes.includes('PMS')
  const colsPerFuel = (ft) => (ft === 'PMS' && showPmsAvg ? 5 : 4)
  const totalCols = 1 + fuelTypes.reduce((s, ft) => s + colsPerFuel(ft), 0)

  return (
    <div className="min-w-[900px] pb-4">
      <h2 className="text-base font-bold text-gray-900 mb-2">
        Sales Overview — {fmtDate(startDate)} to {fmtDate(endDate)}
      </h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={totalCols} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              SALES
            </th>
          </tr>
          <tr className={subHdr}>
            <th rowSpan={2} className={`${cell} font-bold`}>Date</th>
            {fuelTypes.map(ft => (
              <th key={ft} colSpan={colsPerFuel(ft)} className={`${cell} text-center font-bold`}>
                {ft}
              </th>
            ))}
          </tr>
          <tr className={subHdr}>
            {fuelTypes.map(ft => (
              <Fragment key={ft}>
                <th className={`${cellR} font-bold text-xs`}>Sales (Vol)</th>
                {ft === 'PMS' && showPmsAvg && (
                  <th className={`${cellR} font-bold text-xs`}>Avg Vol</th>
                )}
                <th className={`${cellR} font-bold text-xs`}>Price</th>
                <th className={`${cellR} font-bold text-xs`}>Dispensed</th>
                <th className={`${cellR} font-bold text-xs`}>Sales (₦)</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.date} className={row.hasEntry ? '' : 'text-gray-400'}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              {fuelTypes.map(ft => {
                const f = row.fuels[ft] || {}
                return (
                  <Fragment key={ft}>
                    <td className={cellR}>{fmt(f.volume)}</td>
                    {ft === 'PMS' && showPmsAvg && (
                      <td className={cellR}>{fmtDec(row.pmsAvg)}</td>
                    )}
                    <td className={cellR}>{fmt(f.price)}</td>
                    <td className={cellR}>{fmt(f.dispensed)}</td>
                    <td className={cellR}>{fmt(f.amount)}</td>
                  </Fragment>
                )
              })}
            </tr>
          ))}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Total</td>
            {fuelTypes.map(ft => {
              const t = totals[ft] || {}
              return (
                <Fragment key={ft}>
                  <td className={cellR}>{fmt(t.volume)}</td>
                  {ft === 'PMS' && showPmsAvg && (
                    <td className={cellR}></td>
                  )}
                  <td className={cellR}></td>
                  <td className={cellR}>{fmt(t.dispensed)}</td>
                  <td className={cellR}>{fmt(t.amount)}</td>
                </Fragment>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
