'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { initialSync } from '@/lib/initialSync'
import { buildAuditReport } from '@/lib/buildAuditReport'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const SUB_REPORTS = [
  { key: 'sales-cash', label: 'Sales/Cash Position' },
  // Future sub-reports will be added here:
  // { key: 'stock-position', label: 'Stock Position' },
  // { key: 'lodgement-sheet', label: 'Lodgement Sheet' },
  // { key: 'pms-consumption', label: 'PMS Consumption & Pour Back' },
  // { key: 'ago-consumption', label: 'AGO Consumption & Pour Back' },
  // { key: 'dpk-consumption', label: 'DPK Consumption & Pour Back' },
  // { key: 'product-received', label: 'Product Received' },
  // { key: 'expenses', label: 'Expenses' },
  // { key: 'record-stock', label: 'Record of Stock Position' },
  // { key: 'customers-ledger', label: "Customers' Ledger" },
]

export default function AuditReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <AuditReportContent />
    </Suspense>
  )
}

function AuditReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [banks, setBanks] = useState([])

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [generated, setGenerated] = useState(false)
  const [activeTab, setActiveTab] = useState('sales-cash')

  // Committed date range (only updates on Generate)
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      try { await initialSync(orgId) } catch (e) { /* offline */ }
      if (cancelled) return
      const [noz, bnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
      ])
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      setNozzles(noz)
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

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveLodgements || !liveConsumption) return null

    return buildAuditReport({
      sales: liveSales,
      lodgements: liveLodgements,
      consumption: liveConsumption,
      nozzles,
      banks,
      customers: liveCustomers || [],
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, banks, liveSales, liveLodgements, liveConsumption, liveCustomers])

  const handleGenerate = () => {
    if (!startDate || !endDate) return
    setReportStart(startDate)
    setReportEnd(endDate)
    setGenerated(true)
    setActiveTab('sales-cash')
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
    <div className="flex flex-col h-[calc(95vh-4rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between py-3 gap-2 flex-wrap shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Audit Report</h1>
        <div className="flex items-center gap-2">
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

      {/* Report content */}
      {report ? (
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 border border-gray-200">
          {activeTab === 'sales-cash' && (
            <SalesCashPosition report={report} startDate={reportStart} endDate={reportEnd} />
          )}
        </div>
      ) : generated ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
        </div>
      )}

      {/* Sub-report tabs */}
      {generated && report && (
        <div className="flex overflow-x-auto shrink-0 border-t border-blue-200">
          {SUB_REPORTS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-r border-blue-200 shrink-0 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sales / Cash Position sub-report ───

function SalesCashPosition({ report, startDate, endDate }) {
  const { salesCash, fuelTypes } = report
  if (!salesCash) return null

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1.5 py-1`
  const cellR = `${cell} text-right`

  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="min-w-[700px] pb-4">
      <h2 className="text-base font-bold text-gray-900 mb-1">
        Cash/Sales Reconciliation — {formatDate(startDate)} to {formatDate(endDate)}
      </h2>

      {fuelTypes.map((ft, ftIdx) => {
        const summary = salesCash.fuelSummaries[ft]
        if (!summary) return null
        return (
          <FuelSection
            key={ft}
            fuelType={ft}
            index={ftIdx + 1}
            summary={summary}
            startDate={startDate}
            endDate={endDate}
            hdr={hdr}
            subHdr={subHdr}
            cell={cell}
            cellR={cellR}
          />
        )
      })}

      {/* Cash Reconciliation */}
      <CashReconciliation
        data={salesCash.cashReconciliation}
        startDate={startDate}
        endDate={endDate}
        hdr={hdr}
        subHdr={subHdr}
        cell={cell}
        cellR={cellR}
      />
    </div>
  )
}

function FuelSection({ fuelType, index, summary, startDate, endDate, hdr, subHdr, cell, cellR }) {
  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className={`${hdr} px-2 py-1.5 text-sm font-bold mb-0`}>
        {index}. {fuelType} Sales for the Period
      </div>

      {/* Meter reading table */}
      <table className="w-full border-collapse text-sm mb-0">
        <thead>
          <tr className={subHdr}>
            <th className={`${cell} text-left font-bold`}>Meter Reading</th>
            <th className={`${cellR} font-bold`}>Opening ({formatDate(startDate)})</th>
            <th className={`${cellR} font-bold`}>Closing ({formatDate(endDate)})</th>
            <th className={`${cellR} font-bold`}>Dispensed</th>
            <th className={`${cellR} font-bold`}>Price</th>
            <th className={`${cellR} font-bold`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row, rowIdx) => (
            <MeterGroup key={rowIdx} row={row} rowIdx={rowIdx} totalRows={summary.rows.length} cell={cell} cellR={cellR} />
          ))}
        </tbody>
      </table>

      {/* A = Total sales */}
      <table className="w-full border-collapse text-sm mb-4">
        <tbody>
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>A</td>
            <td className={cell}>Total {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.totalDispensed)}</td>
            <td className={cellR}>{fmt(summary.totalAmount)}</td>
          </tr>

          {/* B = Less Pour Back */}
          <tr className="font-bold">
            <td className={cell}>B</td>
            <td className={cell} colSpan={2}>Less Pour Back on {fuelType} for the Period</td>
            <td className={cellR}>{fmt(summary.totalPourBackAmt)}</td>
          </tr>
          {summary.consumption.pourBack.map((item, i) => (
            <tr key={`pb-${i}`}>
              <td className={cell}></td>
              <td className={cell}>{item.name}</td>
              <td className={cellR}>{fmt(item.qty)}</td>
              <td className={cellR}>{fmt(item.amt)}</td>
            </tr>
          ))}

          {/* C = Net Sales */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>C=A-B</td>
            <td className={cell}>Net {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.netSalesQty)}</td>
            <td className={cellR}>{fmt(summary.netSalesAmt)}</td>
          </tr>

          {/* Less Consumption */}
          <tr className="font-bold">
            <td className={cell}></td>
            <td className={cell} colSpan={3}>Less Consumption on {fuelType}</td>
          </tr>
          {summary.consumption.consumed.map((item, i) => (
            <tr key={`c-${i}`}>
              <td className={cell}></td>
              <td className={cell}>{item.name}</td>
              <td className={cellR}>{fmt(item.qty)}</td>
              <td className={cellR}>{fmt(item.amt)}</td>
            </tr>
          ))}

          {/* D = Total Consumption */}
          <tr className="font-bold">
            <td className={cell}>D</td>
            <td className={cell}>Total Consumption of {fuelType} for the Period</td>
            <td className={cellR}>{fmt(summary.totalConsumedQty)}</td>
            <td className={cellR}>{fmt(summary.totalConsumedAmt)}</td>
          </tr>

          {/* E = Expected Sales */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>E=C-D</td>
            <td className={cell}>Expected {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.expectedSalesQty)}</td>
            <td className={cellR}>{fmt(summary.expectedSalesAmt)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function MeterGroup({ row, rowIdx, totalRows, cell, cellR }) {
  return (
    <>
      {/* Spacer rows between price period groups */}
      {rowIdx > 0 && (
        <>
          <tr><td colSpan={6} className="h-2"></td></tr>
          <tr><td colSpan={6} className="h-2"></td></tr>
        </>
      )}
      {row.pumps.map((pump, pIdx) => (
        <tr key={`${rowIdx}-${pIdx}`}>
          <td className={`${cell} font-medium`}>{pump.label}</td>
          <td className={cellR}>{fmt(pump.opening)}</td>
          <td className={cellR}>{fmt(pump.closing)}</td>
          <td className={cellR}>{fmt(pump.dispensed)}</td>
          <td className={cellR}>{fmt(row.price)}</td>
          <td className={cellR}>{fmt(pump.dispensed * row.price)}</td>
        </tr>
      ))}
    </>
  )
}

function CashReconciliation({ data, startDate, endDate, hdr, subHdr, cell, cellR }) {
  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const overshortColor = data.overshort < 0 ? 'text-red-600' : data.overshort > 0 ? 'text-green-600' : ''

  return (
    <div className="mt-6">
      <div className={`${hdr} px-2 py-1.5 text-sm font-bold`}>
        Sales/Lodgement Reconciliation — {formatDate(startDate)} to {formatDate(endDate)}
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Expected Sales from Products for the Period</td>
            <td className={cellR}>{fmt(data.expectedSalesTotal)}</td>
          </tr>
          <tr className="font-bold">
            <td className={cell}>Total Lodgement for the Period</td>
            <td className={cellR}>{fmt(data.totalLodgement)}</td>
          </tr>
          <tr className="font-bold">
            <td className={cell}>Total POS for the Period</td>
            <td className={cellR}>{fmt(data.totalPOS)}</td>
          </tr>
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Overage/Shortage</td>
            <td className={`${cellR} ${overshortColor}`}>
              {data.overshort > 0 ? '+' : ''}{fmt(data.overshort)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
