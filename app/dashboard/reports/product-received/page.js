'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, Calculator, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { exportProductReceiptExcel } from '@/lib/exportProductReceiptExcel'
import DateInput from '@/components/DateInput'
import { fmtDate } from '@/lib/formatDate'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ProductReceivedReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <ProductReceivedReportContent />
    </Suspense>
  )
}

/**
 * Group raw product receipt records (one per tank) into deliveries.
 * Same grouping logic as the entry form.
 */
function groupIntoDeliveries(records, tanksMap) {
  const groups = {}
  for (const r of records) {
    const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
    const key = parts.some(Boolean) ? parts.join('|') : r.id
    if (!groups[key]) groups[key] = { records: [], first: r }
    groups[key].records.push(r)
  }

  return Object.values(groups).map(({ records: recs, first }) => {
    const qtyLoaded = (Number(first.firstCompartment) || 0) +
      (Number(first.secondCompartment) || 0) +
      (Number(first.thirdCompartment) || 0)
    const qtySupplied = recs.reduce((sum, r) => sum + (Number(r.actualVolume) || 0), 0)

    // Collect fuel types from tanks
    const fuelTypes = []
    for (const r of recs) {
      const tank = tanksMap[r.tankId]
      const ft = tank ? tank.fuel_type : null
      if (ft && !fuelTypes.includes(ft)) fuelTypes.push(ft)
    }

    return {
      dischargeDate: first.entryDate || '',
      loadingDate: first.loadedDate || '',
      product: fuelTypes.join(', ') || '—',
      qtyLoaded,
      qtySupplied,
      driverName: first.driverName || '',
      truckNumber: first.truckNumber || '',
      ticketNumber: first.ticketNumber || '',
      waybillNumber: first.waybillNumber || '',
      shortage: qtyLoaded - qtySupplied,
      depot: first.depotName || '',
      // Fields needed for Excel export
      arrivalTime: first.arrivalTime || '',
      exitTime: first.exitTime || '',
      chartUllage: first.chartUllage,
      chartLiquidHeight: first.chartLiquidHeight,
      stationUllage: first.stationUllage,
      stationLiquidHeight: first.stationLiquidHeight,
      depotUllage: first.depotUllage,
      depotLiquidHeight: first.depotLiquidHeight,
      firstCompartment: first.firstCompartment,
      secondCompartment: first.secondCompartment,
      thirdCompartment: first.thirdCompartment,
    }
  })
}

function ProductReceivedReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [generated, setGenerated] = useState(true)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  const [exportingIdx, setExportingIdx] = useState(null)

  // Config
  const [tanks, setTanks] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()
      setTanks(tnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  // Live query
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  // Tank lookup
  const tanksMap = useMemo(() => {
    return Object.fromEntries(tanks.map(t => [t.id, t]))
  }, [tanks])

  // Derive report
  const deliveries = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !liveReceipts) return null

    // Filter to date range
    const filtered = liveReceipts.filter(r => {
      const d = r.entryDate || ''
      return d >= reportStart && d <= reportEnd
    })

    // Sort by discharge date descending (newest first)
    filtered.sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))

    const grouped = groupIntoDeliveries(filtered, tanksMap)

    // Compute totals
    let totalLoaded = 0, totalSupplied = 0, totalShortage = 0
    for (const d of grouped) {
      totalLoaded += d.qtyLoaded
      totalSupplied += d.qtySupplied
      totalShortage += d.shortage
    }

    return { rows: grouped, totalLoaded, totalSupplied, totalShortage }
  }, [generated, reportStart, reportEnd, loading, orgId, liveReceipts, tanksMap])

  const handleExport = async (row, idx) => {
    if (exportingIdx !== null) return
    setExportingIdx(idx)
    try {
      await exportProductReceiptExcel({
        product: row.product,
        truckNumber: row.truckNumber,
        driverName: row.driverName,
        depotName: row.depot,
        ticketNumber: row.ticketNumber,
        waybillNumber: row.waybillNumber,
        loadedDate: row.loadingDate,
        entryDate: row.dischargeDate,
        arrivalTime: row.arrivalTime,
        exitTime: row.exitTime,
        chartUllage: row.chartUllage,
        chartLiquidHeight: row.chartLiquidHeight,
        stationUllage: row.stationUllage,
        stationLiquidHeight: row.stationLiquidHeight,
        depotUllage: row.depotUllage,
        depotLiquidHeight: row.depotLiquidHeight,
        firstCompartment: row.firstCompartment,
        secondCompartment: row.secondCompartment,
        thirdCompartment: row.thirdCompartment,
        qtyReceived: row.qtySupplied,
      })
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Export failed: ' + (err?.message || String(err)))
    } finally {
      setExportingIdx(null)
    }
  }

  const handleGenerate = () => {
    if (!startDate || !endDate) return
    setReportStart(startDate)
    setReportEnd(endDate)
    setGenerated(true)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  const hdr = 'bg-blue-600 text-white'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-2 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Product Received</h1>
        <div className="flex items-center gap-2">
          <DateInput value={startDate} onChange={setStartDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
          <span className="text-sm text-gray-400">to</span>
          <DateInput value={endDate} onChange={setEndDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
          <button
            onClick={handleGenerate}
            disabled={!startDate || !endDate || startDate > endDate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Generate
          </button>
          <Link
            href={`/dashboard/reports/dip-calculator?org_id=${orgId}`}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Calculator className="w-4 h-4" />
            Dip Calculator
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 pb-4 border border-gray-200">
        {!generated ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
          </div>
        ) : !deliveries ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : deliveries.rows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">No product receipts found in this date range.</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className={`${cell} ${hdr} text-left`}>Discharge Date</th>
                <th className={`${cell} ${hdr} text-left`}>Loading Date</th>
                <th className={`${cell} ${hdr} text-left`}>Product</th>
                <th className={`${cell} ${hdr} text-right`}>Qty Loaded</th>
                <th className={`${cell} ${hdr} text-right`}>Qty Supplied</th>
                <th className={`${cell} ${hdr} text-left`}>Driver</th>
                <th className={`${cell} ${hdr} text-left`}>Truck No.</th>
                <th className={`${cell} ${hdr} text-left`}>Ticket ID</th>
                <th className={`${cell} ${hdr} text-left`}>Waybill No.</th>
                <th className={`${cell} ${hdr} text-right`}>Shortage</th>
                <th className={`${cell} ${hdr} text-left`}>Depot</th>
                <th className={`${cell} ${hdr} text-center`}></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.rows.map((row, i) => {
                const shortageColor = row.shortage > 0 ? 'text-red-600 font-medium' : row.shortage < 0 ? 'text-green-600 font-medium' : ''
                return (
                  <tr key={i} className="hover:bg-blue-50/40">
                    <td className={`${cellR} whitespace-nowrap`}>{row.dischargeDate ? fmtDate(row.dischargeDate) : '—'}</td>
                    <td className={`${cellR} whitespace-nowrap`}>{row.loadingDate ? fmtDate(row.loadingDate) : '—'}</td>
                    <td className={cell}>{row.product}</td>
                    <td className={cellR}>{fmt(row.qtyLoaded)}</td>
                    <td className={cellR}>{fmt(row.qtySupplied)}</td>
                    <td className={cell}>{row.driverName || '—'}</td>
                    <td className={cell}>{row.truckNumber || '—'}</td>
                    <td className={cell}>{row.ticketNumber || '—'}</td>
                    <td className={cell}>{row.waybillNumber || '—'}</td>
                    <td className={`${cellR} ${shortageColor}`}>{fmt(row.shortage)}</td>
                    <td className={cell}>{row.depot || '—'}</td>
                    <td className={`${cell} text-center`}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleExport(row, i)}
                          disabled={exportingIdx !== null}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 rounded"
                          title="Export Excel"
                        >
                          {exportingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Export
                        </button>
                        <Link
                          href={`/dashboard/reports/dip-calculator?org_id=${orgId}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          title="Dip Calculator"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-blue-50">
                <td className={cell} colSpan={3}>Total ({deliveries.rows.length} deliveries)</td>
                <td className={cellR}>{fmt(deliveries.totalLoaded)}</td>
                <td className={cellR}>{fmt(deliveries.totalSupplied)}</td>
                <td className={cell} colSpan={4}></td>
                <td className={`${cellR} ${deliveries.totalShortage > 0 ? 'text-red-600' : deliveries.totalShortage < 0 ? 'text-green-600' : ''}`}>
                  {fmt(deliveries.totalShortage)}
                </td>
                <td className={cell}></td>
                <td className={cell}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

