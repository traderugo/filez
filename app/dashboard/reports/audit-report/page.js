'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { buildAuditReport } from '@/lib/buildAuditReport'
import { exportAuditExcel } from '@/lib/exportAuditExcel'
import DateInput from '@/components/DateInput'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const SUB_REPORTS = [
  { key: 'sales-cash', label: 'Sales/Cash Position' },
  // Future sub-reports will be added here:
  { key: 'stock-position', label: 'Record of Stock Position' },
  { key: 'stock-summary', label: 'Stock Position' },
  { key: 'lodgement-sheet', label: 'Lodgement Sheet' },
  { key: 'consumption', label: 'Consumption & Pour Back' },
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

// Extended template limits (1-indexed) — max capacity for truncation check
const EXT_SECTIONS = {
  PMS: { pumpStart: 10, pumpEnd: 163 },
  AGO: { pumpStart: 196, pumpEnd: 251 },
  DPK: { pumpStart: 290, pumpEnd: 335 },
}

function checkTruncationWarnings(report, nozzles) {
  const warnings = []
  if (!report?.salesCash?.fuelSummaries) return warnings
  for (const ft of report.fuelTypes || []) {
    const sec = EXT_SECTIONS[ft]
    if (!sec) continue
    const summary = report.salesCash.fuelSummaries[ft]
    if (!summary?.rows?.length) continue
    const pumpCount = nozzles.filter(n => n.fuel_type === ft).length
    if (!pumpCount) continue
    const blockSize = pumpCount + 1
    const maxBlocks = Math.floor((sec.pumpEnd - sec.pumpStart + 1) / blockSize)
    if (summary.rows.length > maxBlocks) {
      warnings.push(`${ft}: ${summary.rows.length} price periods but only ${maxBlocks} fit in template. Meter readings will be truncated.`)
    }
  }
  return warnings
}

function AuditReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [banks, setBanks] = useState([])
  const [tanks, setTanks] = useState([])
  const [stationName, setStationName] = useState('')

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
  const [activeTab, setActiveTab] = useState('sales-cash')

  // Committed date range (only updates on Generate)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      const [noz, bnk, tnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
      ])
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      setNozzles(noz)
      setBanks(bnk)
      setTanks(tnk)
      setLoading(false)

      // Fetch station name (non-blocking, for export only)
      fetch('/api/organizations').then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data) return
        const all = [...(data.stations || []), ...(data.memberStations || [])]
        const match = all.find(s => s.id === orgId)
        if (match) setStationName(match.name || '')
      }).catch(() => {})

      // Fetch admin-uploaded template URL (non-blocking)
      fetch('/api/excel-templates?name=AUDIT+REPORT+TEMPLATE').then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data?.url) return
        setTemplateUrl(data.url)
      }).catch(() => {})
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
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLubeSales = useLiveQuery(
    () => orgId ? db.lubeSales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLubeStock = useLiveQuery(
    () => orgId ? db.lubeStock.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLubeProducts = useLiveQuery(
    () => orgId ? db.lubeProducts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const [exporting, setExporting] = useState(false)
  const [templateUrl, setTemplateUrl] = useState(null)

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveLodgements || !liveConsumption) return null

    return buildAuditReport({
      sales: liveSales,
      lodgements: liveLodgements,
      consumption: liveConsumption,
      receipts: liveReceipts || [],
      nozzles,
      banks,
      tanks,
      customers: liveCustomers || [],
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, banks, tanks, liveSales, liveLodgements, liveConsumption, liveCustomers, liveReceipts])

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    if (dateRangeDays > 32) {
      alert('Date range cannot exceed 32 days.')
      return
    }
    setReportStart(s)
    setReportEnd(e)
    setGenerated(true)
    setActiveTab('sales-cash')
  }

  const handleExport = async () => {
    if (!report || exporting) return
    setExporting(true)
    try {
      // Pre-check for truncation warnings
      const warnings = checkTruncationWarnings(report, nozzles)
      if (warnings.length) {
        const proceed = window.confirm(
          'Some data will be truncated:\n\n' + warnings.join('\n') + '\n\nProceed with export?'
        )
        if (!proceed) { setExporting(false); return }
      }

      const result = await exportAuditExcel({
        report,
        receipts: liveReceipts || [],
        lubeSales: liveLubeSales || [],
        lubeStock: liveLubeStock || [],
        lubeProducts: liveLubeProducts || [],
        tanks,
        nozzles,
        stationName,
        startDate: reportStart,
        endDate: reportEnd,
        templateUrl,
      })
      if (result.warnings?.length) {
        alert('Export completed with warnings:\n\n' + result.warnings.join('\n'))
      }
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Export failed. Check console for details.')
    } finally {
      setExporting(false)
    }
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
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between py-3 gap-2 flex-wrap shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Audit Report</h1>
        <div className="flex items-center gap-2">
          <DateInput value={startDate} onChange={setStartDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
          <span className="text-sm text-gray-400">to</span>
          <DateInput value={endDate} onChange={setEndDate} className="px-2 py-2 border border-gray-300 text-sm font-medium" />
          <button
            onClick={handleGenerate}
            disabled={!startDate || !endDate || startDate > endDate || dateRangeDays > 32}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Generate
          </button>
          {report && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Excel
            </button>
          )}
        </div>
        {dateRangeDays > 32 && (
          <p className="text-xs text-red-500 mt-1">Date range cannot exceed 32 days ({dateRangeDays} days selected).</p>
        )}
      </div>

      {/* Report content */}
      {report ? (
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
          <div className="px-4 sm:px-8 py-4">
            {activeTab === 'sales-cash' && (
              <SalesCashPosition report={report} startDate={reportStart} endDate={reportEnd} />
            )}
            {activeTab === 'lodgement-sheet' && (
              <LodgementSheet report={report} />
            )}
            {activeTab === 'stock-position' && (
              <StockPosition report={report} />
            )}
            {activeTab === 'stock-summary' && (
              <StockSummary report={report} startDate={reportStart} endDate={reportEnd} />
            )}
            {activeTab === 'consumption' && (
              <ConsumptionReport report={report} startDate={reportStart} endDate={reportEnd} />
            )}
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

      {/* Sub-report tabs (bottom, Excel-style) */}
      {generated && report && (
        <div className="flex overflow-x-auto shrink-0 border-t border-blue-200 bg-gray-50">
          {SUB_REPORTS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium border-r border-blue-200 shrink-0 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 -mt-px'
                  : 'bg-gray-50 text-gray-500 hover:bg-white hover:text-blue-600'
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
    <div className="min-w-[700px] pb-4 px-[10%]">
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
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.totalAmount)}</td>
          </tr>

          {/* B = Less Pour Back */}
          <tr className="font-bold">
            <td className={cell}>B</td>
            <td className={cell} colSpan={3}>Less Pour Back on {fuelType} for the Period</td>
            <td className={cellR}>{fmt(summary.totalPourBackAmt)}</td>
          </tr>
          {(summary.consumption.pourBackByPrice || []).map((group, gi) => (
            <tr key={`pbg-${gi}`}>
              <td className={cell}></td>
              <td className={cell}>{group.entries.map(e => e.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
              <td className={cellR}>{fmt(group.totalQty)}</td>
              <td className={cellR}>{fmt(group.price)}</td>
              <td className={cellR}>{fmt(group.totalAmt)}</td>
            </tr>
          ))}

          {/* C = Net Sales */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>C=A-B</td>
            <td className={cell}>Net {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.netSalesQty)}</td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.netSalesAmt)}</td>
          </tr>

          {/* Less Consumption */}
          <tr className="font-bold">
            <td className={cell}></td>
            <td className={cell} colSpan={4}>Less Consumption on {fuelType}</td>
          </tr>
          {(summary.consumption.consumedByPrice || []).map((group, gi) => (
            <tr key={`cg-${gi}`}>
              <td className={cell}></td>
              <td className={cell}>{group.entries.map(e => e.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
              <td className={cellR}>{fmt(group.totalQty)}</td>
              <td className={cellR}>{fmt(group.price)}</td>
              <td className={cellR}>{fmt(group.totalAmt)}</td>
            </tr>
          ))}

          {/* D = Total Consumption */}
          <tr className="font-bold">
            <td className={cell}>D</td>
            <td className={cell}>Total Consumption of {fuelType} for the Period</td>
            <td className={cellR}>{fmt(summary.totalConsumedQty)}</td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.totalConsumedAmt)}</td>
          </tr>

          {/* E = Expected Sales */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>E=C-D</td>
            <td className={cell}>Expected {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.expectedSalesQty)}</td>
            <td className={cellR}></td>
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
        <tr><td colSpan={6} className="h-2"></td></tr>
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

// ─── Lodgement Sheet sub-report ───

function LodgementSheet({ report }) {
  const { lodgementSheet } = report
  if (!lodgementSheet) return null

  const { rows, banks, totals } = lodgementSheet
  // Only show non-deposit banks as columns (POS, cash, other)
  const displayBanks = banks.filter(b => b.lodgement_type !== 'bank_deposit')
  const posBanks = displayBanks.filter(b => b.lodgement_type === 'pos')
  const otherBanks = displayBanks.filter(b => b.lodgement_type !== 'pos')

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1.5 py-1`
  const cellR = `${cell} text-right`

  const fmtDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getDate()}-${dt.getMonth() + 1}-${dt.getFullYear()}`
  }

  const fmtOvsh = (v) => {
    if (v === 0) return ''
    if (v < 0) return `(${fmt(Math.abs(v))})`
    return fmt(v)
  }

  const ovshColor = (v) => v !== 0 ? 'text-red-600' : ''

  const totalCols = 3 + displayBanks.length + 3
  const visibleRows = rows.filter(r => r.hasData)

  return (
    <div className="min-w-[700px] pb-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={totalCols} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              LODGEMENT
            </th>
          </tr>
          <tr className={subHdr}>
            <th className={`${cell} font-bold`}>Date</th>
            <th className={`${cellR} font-bold`}>Total Sales</th>
            <th className={`${cellR} font-bold`}>Expected</th>
            {posBanks.length > 0 && (
              <th colSpan={posBanks.length} className={`${cell} text-center font-bold`}>
                Analysis of POS by Banks
              </th>
            )}
            {otherBanks.length > 0 && (
              <th colSpan={otherBanks.length} className={`${cell} text-center font-bold`}>
                Other Lodgements
              </th>
            )}
            <th className={`${cellR} font-bold`}>Total POS</th>
            <th className={`${cellR} font-bold`}>Actual</th>
            <th className={`${cellR} font-bold`}>OV/SH</th>
          </tr>
          {displayBanks.length > 0 && (
            <tr className={subHdr}>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              {displayBanks.map(bank => (
                <th key={bank.id} className={`${cellR} font-bold text-xs`}>
                  {bank.bank_name}
                </th>
              ))}
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
            </tr>
          )}
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.date}>
              <td className={cell}>{fmtDate(row.date)}</td>
              <td className={cellR}>{fmt(row.totalSales)}</td>
              <td className={cellR}>{fmt(row.expected)}</td>
              {displayBanks.map(bank => (
                <td key={bank.id} className={cellR}>
                  {fmt(row.bankAmounts[bank.id] || 0)}
                </td>
              ))}
              <td className={cellR}>{fmt(row.totalPOS)}</td>
              <td className={cellR}>{fmt(row.actual)}</td>
              <td className={`${cellR} font-bold ${ovshColor(row.ovsh)}`}>
                {fmtOvsh(row.ovsh)}
              </td>
            </tr>
          ))}
          {visibleRows.length > 0 && (
            <tr className={`${subHdr} font-bold`}>
              <td className={cell}>Total</td>
              <td className={cellR}>{fmt(totals.totalSales)}</td>
              <td className={cellR}>{fmt(totals.expected)}</td>
              {displayBanks.map(bank => (
                <td key={bank.id} className={cellR}>
                  {fmt(totals.bankTotals[bank.id] || 0)}
                </td>
              ))}
              <td className={cellR}>{fmt(totals.totalPOS)}</td>
              <td className={cellR}>{fmt(totals.actual)}</td>
              <td className={`${cellR} ${ovshColor(totals.ovsh)}`}>
                {fmtOvsh(totals.ovsh)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stock Position sub-report ───

function StockPosition({ report }) {
  const { stockPosition, fuelTypes } = report
  const [activeFuel, setActiveFuel] = useState(fuelTypes[0] || 'PMS')

  if (!stockPosition) return null

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1.5 py-1`
  const cellR = `${cell} text-right`

  const fmtDate = (d) => {
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getDate()}-${dt.getMonth() + 1}-${dt.getFullYear()}`
  }

  const ovshColor = (v) => {
    if (v == null || v === 0) return ''
    return v < 0 ? 'text-red-600' : 'text-green-600'
  }

  const fuelData = stockPosition[activeFuel]
  if (!fuelData) return null

  const visibleRows = fuelData.rows.filter(r => r.hasData)
  const { totals } = fuelData

  return (
    <div className="min-w-[700px] pb-4">
      {/* Fuel type tabs */}
      <div className="flex gap-1 mb-4">
        {fuelTypes.map(ft => (
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

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={8} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              RECORD OF STOCK POSITION — {activeFuel}
            </th>
          </tr>
          <tr className={subHdr}>
            <th className={`${cell} font-bold`}>Date</th>
            <th className={`${cellR} font-bold`}>Opening Stock</th>
            <th className={`${cellR} font-bold`}>Actual Product Supplied</th>
            <th className={`${cellR} font-bold`}>Quantity Sold</th>
            <th className={`${cellR} font-bold`}>Closing Stock</th>
            <th className={`${cellR} font-bold`}>OV/SH</th>
            <th className={`${cellR} font-bold`}>Actual OV/SH</th>
            <th className={`${cellR} font-bold`}>VARIANCE</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(row => (
            <tr key={row.date}>
              <td className={cell}>{fmtDate(row.date)}</td>
              <td className={cellR}>{fmt(row.opening)}</td>
              <td className={cellR}>{fmt(row.supply)}</td>
              <td className={cellR}>{fmt(row.qtySold)}</td>
              <td className={cellR}>{fmt(row.closing)}</td>
              <td className={`${cellR} ${ovshColor(row.ovsh)}`}>{fmt(row.ovsh)}</td>
              <td className={`${cellR} ${ovshColor(row.actualOvsh)}`}>{fmt(row.actualOvsh)}</td>
              <td className={cellR}></td>
            </tr>
          ))}
          {visibleRows.length > 0 && (
            <tr className={`${subHdr} font-bold`}>
              <td className={cell}>Total</td>
              <td className={cellR}>{fmt(totals.opening)}</td>
              <td className={cellR}>{fmt(totals.supply)}</td>
              <td className={cellR}>{fmt(totals.qtySold)}</td>
              <td className={cellR}>{fmt(totals.closing)}</td>
              <td className={`${cellR} ${ovshColor(totals.ovsh)}`}>{fmt(totals.ovsh)}</td>
              <td className={`${cellR} ${ovshColor(totals.actualOvsh)}`}>{fmt(totals.actualOvsh)}</td>
              <td className={cellR}></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function StockSummary({ report, startDate, endDate }) {
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return null

  const fmtDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const hdr = 'bg-blue-600 text-white font-bold'
  const cell = 'border border-blue-200 px-3 py-1.5 text-sm'
  const cellR = cell + ' text-right'

  const fmtOvsh = (n) => {
    if (n == null || isNaN(n)) return ''
    const v = Number(n)
    if (v < 0) return `(${fmt(Math.abs(v))})`
    return fmt(v)
  }

  return (
    <div>
      {/* Title */}
      <div className="mb-3">
        <p className="text-xs font-bold uppercase">
          STOCK POSITION FOR THE PERIOD ({fmtDate(startDate)} - {fmtDate(endDate)})
        </p>
      </div>

      {fuelTypes.map((ft) => {
        const data = stockPosition[ft]
        if (!data) return null
        const t = data.totals
        const stockAvailable = t.opening + t.supply

        return (
          <div key={ft} className="mb-6">
            <table className="w-full border-collapse border border-blue-200">
              <thead>
                <tr className={hdr}>
                  <th className={cell + ' text-left w-[65%]'}>{ft} STOCK POSITION</th>
                  <th className={cell + ' text-right w-[35%]'}>Per Manager&apos;s Computation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cell + ' font-bold'}>OPENING STOCK ({fmtDate(startDate)})</td>
                  <td className={cellR}>{fmt(t.opening)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>SUPPLIES DURING THE PERIOD</td>
                  <td className={cellR}>{fmt(t.supply)}</td>
                </tr>
                <tr className="font-bold">
                  <td className={cell}>STOCK AVAILABLE FOR SALE</td>
                  <td className={cellR}>{fmt(stockAvailable)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>CLOSING STOCK ({fmtDate(endDate)})</td>
                  <td className={cellR}>{fmt(t.closing)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>QUANTITY SOLD</td>
                  <td className={cellR}>{fmt(t.qtySold)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>QUANTITY DISPENSED</td>
                  <td className={cellR}>{fmt(t.dispensed)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>OVERAGE/(SHORTAGE)</td>
                  <td className={cellR}>{fmtOvsh(t.ovsh)}</td>
                </tr>
                {/* Spacer */}
                <tr>
                  <td className={cell}>&nbsp;</td>
                  <td className={cell}></td>
                </tr>
                {/* Truck driver section */}
                <tr>
                  <td className={cell + ' font-bold'}>EXPECTED LITRES</td>
                  <td className={cellR}>{fmt(t.expectedLitres)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>ACTUAL LITRES RECEIVED</td>
                  <td className={cellR}>{fmt(t.actualLitresReceived)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>OVERAGE/(SHORTAGE) - TRUCK DRIVER</td>
                  <td className={cellR}>{fmtOvsh(t.truckDriverOvsh)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function ConsumptionReport({ report, startDate, endDate }) {
  const { consumptionReport, fuelTypes } = report
  const [activeFuel, setActiveFuel] = useState(fuelTypes?.[0] || 'PMS')

  if (!consumptionReport) return null

  const fmtDate = (d) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const hdr = 'bg-blue-600 text-white'
  const subHdr = 'bg-blue-50 text-blue-900'
  const cell = 'border border-blue-200 px-2 py-1 text-sm'
  const cellR = cell + ' text-right'

  const data = consumptionReport[activeFuel]
  if (!data) return null

  const { customers, rows, totals } = data

  return (
    <div>
      {/* Fuel type tabs */}
      <div className="flex gap-1 mb-4">
        {fuelTypes.map(ft => (
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-blue-200 text-sm">
          <thead>
            <tr className={hdr}>
              <th className={cell + ' text-left'}>Date</th>
              <th className={cellR}>Rate (N)</th>
              {customers.map(c => (
                <th key={c.id} className={cellR}>{c.name}</th>
              ))}
              <th className={cellR}>Pour back</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const d = new Date(row.date + 'T00:00:00')
              const hasAnyValue = row.hasData || customers.some(c => row.customerQtys[c.id]) || row.pourBack
              return (
                <tr key={row.date} className={hasAnyValue ? '' : 'text-gray-400'}>
                  <td className={cell}>
                    {d.toLocaleDateString('en-NG', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                  </td>
                  <td className={cellR}>{fmt(row.rate)}</td>
                  {customers.map(c => (
                    <td key={c.id} className={cellR}>
                      {row.customerQtys[c.id] ? fmt(row.customerQtys[c.id]) : '0'}
                    </td>
                  ))}
                  <td className={cellR}>{row.pourBack ? fmt(row.pourBack) : '0'}</td>
                </tr>
              )
            })}
            {/* Totals row */}
            <tr className={`${subHdr} font-bold`}>
              <td className={cell}>Total</td>
              <td className={cellR}></td>
              {customers.map(c => (
                <td key={c.id} className={cellR}>{fmt(totals.customerTotals[c.id])}</td>
              ))}
              <td className={cellR}>{fmt(totals.pourBack)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No consumption entries for {activeFuel} in this period.
        </p>
      )}
    </div>
  )
}
