'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, LineChart, BarChart, PieChart, Pie, Cell,
  Line, Bar, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { db } from '@/lib/db'
import { buildAnalyticsReport } from '@/lib/buildAnalyticsReport'
import { fmtDate } from '@/lib/formatDate'
import DateInput from '@/components/DateInput'
import AccessGate from '@/components/AccessGate'

const FUEL_COLORS = { PMS: '#2563eb', AGO: '#16a34a', DPK: '#f59e0b' }

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtCompact(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + 'K'
  return String(Math.round(v))
}

function fmtDay(s) {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <AnalyticsContent />
    </Suspense>
  )
}

function AnalyticsContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

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
      const [noz, tnk, bnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
      ])
      if (cancelled) return
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

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements) return null
    return buildAnalyticsReport({
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

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    if (dateRangeDays > 92) {
      alert('Date range cannot exceed 92 days.')
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
    <AccessGate orgId={orgId} pageKey="report-analytics">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-end py-3">
          <div className="flex items-center gap-2">
            <DateInput value={startDate} onChange={setStartDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
            <span className="text-sm text-gray-400">to</span>
            <DateInput value={endDate} onChange={setEndDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
            <button
              onClick={handleGenerate}
              disabled={generating || !startDate || !endDate || startDate > endDate || dateRangeDays > 92}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generating && <Loader2 className="w-4 h-4 animate-spin" />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
        {dateRangeDays > 92 && (
          <p className="text-xs text-red-500 mt-1">Date range cannot exceed 92 days ({dateRangeDays} days selected).</p>
        )}

        {report ? (
          <AnalyticsBody report={report} startDate={reportStart} endDate={reportEnd} />
        ) : generated ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
          </div>
        )}
      </div>
    </AccessGate>
  )
}

function KpiTile({ label, value, sub, accent }) {
  return (
    <div className="border border-gray-200 bg-white px-3 py-2.5">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold ${accent || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  )
}

function AnalyticsBody({ report, startDate, endDate }) {
  const { fuelTypes, summary, fuelMix, stockSeries, varianceSeries, revenueSeries, ovshSeries } = report

  const stockSubtitle = fuelTypes.map(ft => `${ft}: ${fmt(summary.currentStockByFuel[ft] || 0)}L`).join(' · ')

  const fuelMixData = fuelTypes.map(ft => ({ name: ft, value: fuelMix[ft] || 0 }))

  const ovshAccent = summary.netOvsh < 0 ? 'text-red-600' : summary.netOvsh > 0 ? 'text-green-600' : ''
  const pendingAccent = summary.pendingLodgement > 0 ? 'text-amber-600' : ''

  const tooltipFmt = (value) => '₦' + fmt(value)
  const literFmt = (value) => fmt(value) + 'L'

  return (
    <div className="pb-10">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <KpiTile
          label="Total Sales"
          value={'₦' + fmt(summary.totalSales)}
          sub={`${summary.dayCount} day${summary.dayCount === 1 ? '' : 's'}`}
        />
        <KpiTile
          label="Total Volume"
          value={fmt(summary.totalVolume) + ' L'}
          sub={`avg ${fmt(summary.avgDailyVolume)} L/day`}
        />
        <KpiTile
          label="Net Cash OV/SH"
          value={(summary.netOvsh >= 0 ? '₦' : '-₦') + fmt(Math.abs(summary.netOvsh))}
          accent={ovshAccent}
          sub={summary.netOvsh < 0 ? 'shortage' : summary.netOvsh > 0 ? 'overage' : 'reconciled'}
        />
        <KpiTile
          label="Avg Daily Sales"
          value={'₦' + fmt(summary.avgDailyRevenue)}
        />
        <KpiTile
          label="Current Stock"
          value={fmt(Object.values(summary.currentStockByFuel).reduce((s, v) => s + v, 0)) + ' L'}
          sub={stockSubtitle}
        />
        <KpiTile
          label="Pending Lodgement"
          value={'₦' + fmt(Math.max(0, summary.pendingLodgement))}
          accent={pendingAccent}
          sub={summary.pendingLodgement > 0 ? 'sales not yet deposited' : 'all deposited'}
        />
      </div>

      {/* Stock level over time */}
      <ChartCard title="Stock level over time" subtitle="Closing stock per fuel · dots mark days with deliveries">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={stockSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
            <YAxis tickFormatter={fmtCompact} fontSize={11} />
            <Tooltip
              labelFormatter={(d) => fmtDate(d)}
              formatter={(value, name) => name.endsWith('_delivery') ? null : [literFmt(value), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {fuelTypes.map(ft => (
              <Line
                key={ft}
                type="monotone"
                dataKey={ft}
                name={ft}
                stroke={FUEL_COLORS[ft]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {fuelTypes.map(ft => (
              <Scatter
                key={`${ft}_dlv`}
                dataKey={`${ft}_delivery`}
                name={`${ft} delivery`}
                fill={FUEL_COLORS[ft]}
                shape="circle"
                isAnimationActive={false}
                legendType="none"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Variance vs ±1.25% tolerance */}
      <ChartCard title="Variance vs ±1.25% tolerance" subtitle="Per fuel · positive = within tolerance, negative = beyond">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={varianceSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
            <YAxis tickFormatter={fmtCompact} fontSize={11} />
            <Tooltip
              labelFormatter={(d) => fmtDate(d)}
              formatter={(value, name) => [fmt(value) + ' L', name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            {fuelTypes.map(ft => (
              <Line
                key={ft}
                type="monotone"
                dataKey={ft}
                stroke={FUEL_COLORS[ft]}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Revenue + fuel mix side-by-side on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 mb-6">
        <ChartCard title="Daily revenue" subtitle="Stacked by fuel">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
              <YAxis tickFormatter={fmtCompact} fontSize={11} />
              <Tooltip
                labelFormatter={(d) => fmtDate(d)}
                formatter={(value, name) => [tooltipFmt(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {fuelTypes.map(ft => (
                <Bar key={ft} dataKey={ft} stackId="a" fill={FUEL_COLORS[ft]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fuel mix" subtitle="Share of revenue">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip formatter={(value, name) => [tooltipFmt(value), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Pie
                data={fuelMixData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                isAnimationActive={false}
              >
                {fuelMixData.map((entry) => (
                  <Cell key={entry.name} fill={FUEL_COLORS[entry.name]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Cumulative cash OV/SH */}
      <ChartCard title="Cumulative cash overage / shortage" subtitle="Running total of (lodged − expected) per day">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ovshSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
            <YAxis tickFormatter={fmtCompact} fontSize={11} />
            <Tooltip
              labelFormatter={(d) => fmtDate(d)}
              formatter={(value, name) => [tooltipFmt(value), name === 'cumulative' ? 'Cumulative' : 'Daily']}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="cumulative" stroke="#0f172a" strokeWidth={2} dot={false} isAnimationActive={false} name="Cumulative" />
            <Line type="monotone" dataKey="daily" stroke="#94a3b8" strokeWidth={1} dot={false} isAnimationActive={false} name="Daily" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="border border-gray-200 bg-white p-3 mb-6">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
