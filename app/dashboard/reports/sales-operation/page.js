'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { buildSalesOperationReport } from '@/lib/buildSalesOperationReport'
import { exportSalesOperationExcel } from '@/lib/exportSalesOperationExcel'
import { usePageAccess } from '@/lib/hooks/usePageAccess'
import DateInput from '@/components/DateInput'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SalesOperationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <SalesOperationContent />
    </Suspense>
  )
}

function SalesOperationContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const { isOwner } = usePageAccess(orgId, 'report-sales-operation')

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
  const [generated, setGenerated] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)
  const [activeSheetName, setActiveSheetName] = useState('')
  const [tabOffset, setTabOffset] = useState(0)
  const TAB_COUNT = 14

  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])
  const [lubeProducts, setLubeProducts] = useState([])
  const [stationName, setStationName] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      const [noz, tnk, bnk, lp] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
        db.lubeProducts.where('orgId').equals(orgId).toArray(),
      ])
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)
      setBanks(bnk)
      setLubeProducts(lp)
      setLoading(false)

      fetch('/api/organizations').then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data) return
        const all = [...(data.stations || []), ...(data.memberStations || [])]
        const match = all.find(s => s.id === orgId)
        if (match) setStationName(match.name || '')
      }).catch(() => {})
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
  const liveLubeSales = useLiveQuery(
    () => orgId ? db.lubeSales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length) return null
    if (!liveSales || !liveReceipts || !liveLodgements || !liveLubeSales) return null

    return buildSalesOperationReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      lubeSales: liveLubeSales,
      lubeProducts,
      nozzles,
      tanks,
      banks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, lubeProducts, liveSales, liveReceipts, liveLodgements, liveLubeSales])

  // Reset active sheet when report changes
  useEffect(() => {
    if (!report?.sheets?.length) return
    if (!report.sheets.find(s => s.sheetName === activeSheetName)) {
      setActiveSheetName(report.sheets[0].sheetName)
      setTabOffset(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])

  // Auto-scroll tabs so active sheet is visible
  useEffect(() => {
    if (!report?.sheets) return
    const idx = report.sheets.findIndex(s => s.sheetName === activeSheetName)
    if (idx < tabOffset) setTabOffset(idx)
    else if (idx >= tabOffset + TAB_COUNT) setTabOffset(idx - TAB_COUNT + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetName, report])

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
    }, 500)
  }

  const handleExport = async () => {
    if (!report) return
    setExporting(true)
    try {
      await exportSalesOperationExcel({
        report,
        stationName,
        startDate: reportStart,
        endDate: reportEnd,
      })
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

  const activeSheet = report?.sheets.find(s => s.sheetName === activeSheetName) || null
  const subHdr = 'bg-blue-50 text-blue-600'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-1.5 py-1`
  const cellR = `${cell} text-right`

  return (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
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
              {isOwner && (
                <button
                  onClick={handleExport}
                  disabled={exporting || !report}
                  className="px-3 py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                  title="Export to Excel"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {!generated ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
            </div>
          ) : !report ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : !activeSheet ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400 text-sm">No sheets in this range.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 border border-gray-200">
              <div className="p-2 sm:p-3 space-y-4 min-w-[760px]">
                <SheetTitle sheet={activeSheet} stationName={stationName} />
                <FuelTable sheet={activeSheet} cell={cell} cellR={cellR} subHdr={subHdr} />
                <StockTable sheet={activeSheet} cell={cell} cellR={cellR} subHdr={subHdr} />
                <BankRows sheet={activeSheet} cell={cell} cellR={cellR} subHdr={subHdr} />
                <CashRecon sheet={activeSheet} cell={cell} cellR={cellR} subHdr={subHdr} />
                <LubeBreakdown sheet={activeSheet} cell={cell} cellR={cellR} subHdr={subHdr} />
              </div>
            </div>
          )}

          {/* Sheet tabs */}
          {generated && report?.sheets?.length > 0 && (
            <>
              {/* Mobile */}
              <div className="flex overflow-x-auto shrink-0 border-t border-blue-200 md:hidden">
                {report.sheets.map(s => {
                  const isActive = s.sheetName === activeSheetName
                  return (
                    <button
                      key={s.sheetName}
                      onClick={() => setActiveSheetName(s.sheetName)}
                      className={`px-2 py-1.5 text-xs font-medium border-r border-blue-200 shrink-0 ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
                    >
                      {s.sheetName}
                    </button>
                  )
                })}
              </div>
              {/* Desktop */}
              <div className="hidden md:flex items-center justify-center shrink-0 border-t border-blue-200">
                <button
                  onClick={() => setTabOffset(Math.max(0, tabOffset - 1))}
                  disabled={tabOffset <= 0}
                  className="p-1.5 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex overflow-hidden">
                  {report.sheets.slice(tabOffset, tabOffset + TAB_COUNT).map(s => {
                    const isActive = s.sheetName === activeSheetName
                    return (
                      <button
                        key={s.sheetName}
                        onClick={() => setActiveSheetName(s.sheetName)}
                        className={`px-3 py-1.5 text-sm font-medium border-r border-blue-200 ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                      >
                        {s.sheetName}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setTabOffset(Math.min(Math.max(0, report.sheets.length - TAB_COUNT), tabOffset + 1))}
                  disabled={tabOffset >= report.sheets.length - TAB_COUNT}
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

function SheetTitle({ sheet, stationName }) {
  return (
    <div className="text-sm text-gray-700 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span><span className="font-bold">Station:</span> {stationName || '—'}</span>
      <span><span className="font-bold">Date:</span> {sheet.date}{sheet.shiftIndex > 1 ? ` (shift ${sheet.shiftIndex})` : ''}</span>
    </div>
  )
}

function FuelTable({ sheet, cell, cellR, subHdr }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className={subHdr}>
          <th className={`${cell} text-left font-bold`}></th>
          <th className={`${cellR} font-bold`}>Price 1</th>
          <th className={`${cellR} font-bold`}>Sales @P1</th>
          <th className={`${cellR} font-bold`}>RTT @P1</th>
          <th className={`${cellR} font-bold`}>Cons. @P1</th>
          <th className={`${cellR} font-bold`}>Price 2</th>
          <th className={`${cellR} font-bold`}>Sales @P2</th>
          <th className={`${cellR} font-bold`}>RTT @P2</th>
          <th className={`${cellR} font-bold`}>Cons. @P2</th>
          <th className={`${cellR} font-bold`}>Total (Ltrs)</th>
          <th className={`${cellR} font-bold`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {sheet.fuel.map(f => (
          <tr key={f.fuelType}>
            <td className={`${cell} font-bold`}>{f.fuelType}</td>
            <td className={cellR}>{fmt(f.price1)}</td>
            <td className={cellR}>{fmt(f.actualSalesP1)}</td>
            <td className={cellR}>{fmt(f.rttP1)}</td>
            <td className={cellR}>{fmt(f.consP1)}</td>
            <td className={cellR}>{fmt(f.price2)}</td>
            <td className={cellR}>{fmt(f.actualSalesP2)}</td>
            <td className={cellR}>{fmt(f.rttP2)}</td>
            <td className={cellR}>{fmt(f.consP2)}</td>
            <td className={cellR}>{fmt(f.totalActualLtrs)}</td>
            <td className={cellR}>{fmt(f.amount)}</td>
          </tr>
        ))}
        <tr>
          <td className={`${cell} font-bold`}>LUBES</td>
          <td className={cellR} colSpan={9}></td>
          <td className={cellR}>{fmt(sheet.lube.reduce((s, l) => s + (l.amount || 0), 0))}</td>
        </tr>
      </tbody>
    </table>
  )
}

function StockTable({ sheet, cell, cellR, subHdr }) {
  return (
    <div>
      <div className={`${subHdr} ${cell} font-bold text-center`}>STOCK INVENTORY (LITRES)</div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className={subHdr}>
            <th className={`${cell} text-left font-bold`}></th>
            <th className={`${cellR} font-bold`}>Opening</th>
            <th className={`${cellR} font-bold`}>Waybill</th>
            <th className={`${cellR} font-bold`}>Actual Recd</th>
            <th className={`${cellR} font-bold`}>Truck Short.</th>
            <th className={`${cellR} font-bold`}>Total Disp.</th>
            <th className={`${cellR} font-bold`}>Closing</th>
          </tr>
        </thead>
        <tbody>
          {sheet.stock.map(s => (
            <tr key={s.fuelType}>
              <td className={`${cell} font-bold`}>{s.fuelType}</td>
              <td className={cellR}>{fmt(s.opening)}</td>
              <td className={cellR}>{fmt(s.waybill)}</td>
              <td className={cellR}>{fmt(s.actualReceived)}</td>
              <td className={cellR}>{fmt((s.actualReceived || 0) - (s.waybill || 0))}</td>
              <td className={cellR}>{fmt(s.totalDispensed)}</td>
              <td className={cellR}>{fmt(s.closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BankRows({ sheet, cell, cellR, subHdr }) {
  const { deposits, pos } = sheet.bankRows
  if (deposits.length === 0 && pos.length === 0) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className={`${subHdr} ${cell} font-bold text-center`}>Deposits</div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {deposits.length === 0 ? (
              <tr><td className={`${cell} text-gray-400`} colSpan={2}>None</td></tr>
            ) : deposits.map((d, i) => (
              <tr key={i}>
                <td className={cell}>{d.bankName}</td>
                <td className={cellR}>{fmt(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className={`${subHdr} ${cell} font-bold text-center`}>POS</div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {pos.length === 0 ? (
              <tr><td className={`${cell} text-gray-400`} colSpan={2}>None</td></tr>
            ) : pos.map((p, i) => (
              <tr key={i}>
                <td className={cell}>{p.bankName}</td>
                <td className={cellR}>{fmt(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CashRecon({ sheet, cell, cellR, subHdr }) {
  const c = sheet.cash
  return (
    <div>
      <div className={`${subHdr} ${cell} font-bold text-center`}>CASH RECONCILIATION (₦)</div>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <td className={`${cell} font-bold`}>Total Expected Sales</td>
            <td className={cellR}>{fmt(c.totalExpectedSales)}</td>
            <td className={`${cell} font-bold`}>Previous Day Cash</td>
            <td className={cellR}>{fmt(c.prevDayCash)}</td>
          </tr>
          <tr>
            <td className={`${cell} font-bold`}>Total Bank Deposit</td>
            <td className={cellR}>{fmt(c.totalBankDeposit)}</td>
            <td className={`${cell} font-bold`}>Total POS</td>
            <td className={cellR}>{fmt(c.totalPOS)}</td>
          </tr>
          <tr>
            <td className={`${cell} font-bold`}>Expected Cash @ Hand</td>
            <td className={cellR}>{fmt(c.expectedCashAtHand)}</td>
            <td className={`${cell} font-bold`}>Actual Cash @ Hand</td>
            <td className={cellR}>{fmt(c.actualCashAtHand)}</td>
          </tr>
          {c.reason && (
            <tr>
              <td className={`${cell} font-bold`}>Reason</td>
              <td className={cell} colSpan={3}>{c.reason}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function LubeBreakdown({ sheet, cell, cellR, subHdr }) {
  if (!sheet.lube || sheet.lube.length === 0) return null
  const totals = sheet.lube.reduce((acc, l) => ({
    opening: acc.opening + (l.openingStock || 0),
    supply: acc.supply + (l.productSupply || 0),
    sales: acc.sales + (l.sales || 0),
    closing: acc.closing + (l.closingStock || 0),
    amount: acc.amount + (l.amount || 0),
  }), { opening: 0, supply: 0, sales: 0, closing: 0, amount: 0 })

  return (
    <div>
      <div className={`${subHdr} ${cell} font-bold text-center`}>LUBE SALES BREAKDOWN</div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className={subHdr}>
            <th className={`${cell} text-left font-bold`}>Product</th>
            <th className={`${cellR} font-bold`}>Litre</th>
            <th className={`${cellR} font-bold`}>Unit Price</th>
            <th className={`${cellR} font-bold`}>Opening</th>
            <th className={`${cellR} font-bold`}>Supply</th>
            <th className={`${cellR} font-bold`}>Sales</th>
            <th className={`${cellR} font-bold`}>Closing</th>
            <th className={`${cellR} font-bold`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sheet.lube.map((l, i) => (
            <tr key={i}>
              <td className={cell}>{l.productName}</td>
              <td className={cellR}>{fmt(l.litre)}</td>
              <td className={cellR}>{fmt(l.unitPrice)}</td>
              <td className={cellR}>{fmt(l.openingStock)}</td>
              <td className={cellR}>{fmt(l.productSupply)}</td>
              <td className={cellR}>{fmt(l.sales)}</td>
              <td className={cellR}>{fmt(l.closingStock)}</td>
              <td className={cellR}>{fmt(l.amount)}</td>
            </tr>
          ))}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>TOTAL</td>
            <td className={cellR}></td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(totals.opening)}</td>
            <td className={cellR}>{fmt(totals.supply)}</td>
            <td className={cellR}>{fmt(totals.sales)}</td>
            <td className={cellR}>{fmt(totals.closing)}</td>
            <td className={cellR}>{fmt(totals.amount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
