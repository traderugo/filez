'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
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

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [reportDate, setReportDate] = useState(todayStr)
  const [generated, setGenerated] = useState(true)

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

  const report = useMemo(() => {
    if (!generated || !reportDate) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements || !liveConsumption) return null
    return buildDailyReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      consumption: liveConsumption,
      nozzles,
      tanks,
      banks,
      startDate: reportDate,
      endDate: reportDate,
    })
  }, [generated, reportDate, loading, orgId, nozzles, tanks, banks, liveSales, liveReceipts, liveLodgements, liveConsumption])

  const dayReport = useMemo(() => {
    if (!report?.dateReports?.length) return null
    return report.dateReports[0]
  }, [report])

  const handleGenerate = () => {
    if (!selectedDate) return
    setReportDate(selectedDate)
    setGenerated(true)
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

  const dateLabel = reportDate
    ? new Date(reportDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="flex flex-col h-[calc(95vh-4rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between py-3 gap-2 flex-wrap shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Summary</h1>
        <div className="flex items-center gap-2">
          <DateInput
            value={selectedDate}
            onChange={setSelectedDate}
            className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleGenerate}
            disabled={!selectedDate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Content */}
      {!generated ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Select a date and click Generate.</p>
        </div>
      ) : !report ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !dayReport ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No data for this date.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3">
          {/* DAY header */}
          <table className="w-full border-collapse text-sm mb-0">
            <tbody>
              <tr className={hdr}>
                <td className={cell} colSpan={2}>DAY</td>
                <td className={cell}>{new Date(reportDate + 'T00:00:00').getDate()}</td>
                <td className={cell} colSpan={3}></td>
              </tr>
              <tr>
                <td className={`${cell} text-center text-xs text-gray-600 bg-gray-50`} colSpan={6}>{dateLabel}</td>
              </tr>
            </tbody>
          </table>

          {/* Top section: Dispensed + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-w-[600px]">
            {/* LEFT: Dispensed per nozzle */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {report.fuelTypes.map(ft => {
                    const totals = dayReport.dayFuelTotals[ft]
                    if (!totals) return null
                    // Collect all nozzle rows for this fuel across all entry groups
                    const nozzleRows = []
                    for (const group of dayReport.entryGroups) {
                      const fuelGroup = group.nozzleRows.find(nr => nr.fuelType === ft)
                      if (fuelGroup) {
                        for (const r of fuelGroup.rows) {
                          nozzleRows.push(r)
                        }
                      }
                    }
                    // For multi-nozzle fuels, show per-nozzle dispensed then subtotal
                    if (nozzleRows.length > 1) {
                      return (
                        <DispensedFuelRows key={ft} fuelType={ft} nozzleRows={nozzleRows} total={totals.dispensed} cell={cell} cellR={cellR} />
                      )
                    }
                    // Single nozzle
                    return (
                      <tr key={ft}>
                        <td className={`${cell} font-bold`}>{ft}</td>
                        <td className={cellR}>{fmt(totals.dispensed)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Summary */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className={subHdr}>
                    <td className={`${cell} font-bold`} colSpan={2}>Summary</td>
                  </tr>
                  <tr className="font-bold">
                    <td className={cell}>SALES</td>
                    <td className={cellR}>{fmt(dayReport.totalSales)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td className={cell}>POS</td>
                    <td className={cellR}>{fmt(dayReport.lodgement.totalPOS)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td className={cell}>CASH</td>
                    <td className={cellR}>{fmt(dayReport.cashBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Product Received + Transfer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-w-[600px]">
            {/* LEFT: Product Received */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className={subHdr}>
                    <td className={`${cell} font-bold`}>Product Received</td>
                    <td className={cellR}></td>
                  </tr>
                  {report.fuelTypes.map(ft => {
                    const tankData = dayReport.tanksByFuel?.[ft]
                    const supply = tankData?.totalSupply || 0
                    return (
                      <tr key={ft}>
                        <td className={cell}>{ft}</td>
                        <td className={cellR}>{fmt(supply)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Transfer */}
            <div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className={subHdr}>
                    <td className={`${cell} font-bold`} colSpan={2}>Transfer</td>
                  </tr>
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
                    <tr><td colSpan={2} className={`${cell} text-gray-400`}></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nozzle closing readings per entry */}
          {dayReport.entryGroups.map((group) => (
            <div key={group.entryIndex}>
              <NozzleReadingsEntry
                group={group}
                fuelTypes={report.fuelTypes}
                cell={cell}
                cellR={cellR}
                subHdr={subHdr}
              />

              {/* Total volume sold for this entry */}
              <table className="w-full border-collapse text-sm mb-4">
                <tbody>
                  <tr className={subHdr}>
                    <td className={`${cell} font-bold`} colSpan={2}>Total volume sold</td>
                  </tr>
                  {report.fuelTypes.map(ft => {
                    const fuelGroup = group.nozzleRows.find(nr => nr.fuelType === ft)
                    if (!fuelGroup) return null
                    const dispensed = fuelGroup.totals.dispensed
                    const consumed = fuelGroup.totals.consumed
                    const pourBack = fuelGroup.totals.pourBack || 0
                    const adjustment = consumed + pourBack
                    const actual = fuelGroup.totals.actual
                    return (
                      <tr key={ft}>
                        <td className={cell} colSpan={2}>
                          {ft} &gt; {fmt(dispensed)} &minus; {fmt(adjustment)} = {fmt(actual)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* Tank stock */}
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
              {dayReport.tankSummaryRows.map((row) => (
                <TankRow key={row.fuelType} row={row} cell={cell} cellR={cellR} subHdr={subHdr} />
              ))}
            </tbody>
          </table>

          {/* Consumption entries */}
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
                    <td className={`${cell} text-center text-xs`}>{c.isPourBack ? 'Pour Back' : 'Consumption'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

/** Dispensed rows for a multi-nozzle fuel type */
function DispensedFuelRows({ fuelType, nozzleRows, total, cell, cellR }) {
  return (
    <>
      {nozzleRows.map((r) => (
        <tr key={r.label}>
          <td className={`${cell} font-bold`}>{r.label}</td>
          <td className={cellR}>{fmt(r.dispensed)}</td>
        </tr>
      ))}
      <tr className="font-bold bg-gray-50">
        <td className={cell}></td>
        <td className={cellR}>{fmt(total)}</td>
      </tr>
    </>
  )
}

/** Nozzle closing readings for one entry, split into 2-col grid by fuel type */
function NozzleReadingsEntry({ group, fuelTypes, cell, cellR, subHdr }) {
  // Split fuel types into left (first fuel, typically PMS) and right (rest)
  const leftFuels = fuelTypes.slice(0, 1)
  const rightFuels = fuelTypes.slice(1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-w-[600px] mb-0">
      {/* Left column */}
      <div>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {leftFuels.map(ft => {
              const fuelGroup = group.nozzleRows.find(nr => nr.fuelType === ft)
              if (!fuelGroup) return null
              return (
                <NozzleClosingRows key={ft} fuelType={ft} rows={fuelGroup.rows} cell={cell} cellR={cellR} subHdr={subHdr} />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Right column */}
      <div>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rightFuels.map(ft => {
              const fuelGroup = group.nozzleRows.find(nr => nr.fuelType === ft)
              if (!fuelGroup) return null
              return (
                <NozzleClosingRows key={ft} fuelType={ft} rows={fuelGroup.rows} cell={cell} cellR={cellR} subHdr={subHdr} />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Renders nozzle closing meter readings for one fuel type */
function NozzleClosingRows({ fuelType, rows, cell, cellR, subHdr }) {
  return (
    <>
      <tr className={subHdr}>
        <td className={`${cell} font-bold`} colSpan={2}>{fuelType}</td>
      </tr>
      {rows.map((r, i) => (
        <tr key={r.label}>
          <td className={`${cell} font-bold`}>{i + 1}</td>
          <td className={cellR}>{fmt(r.closing)}</td>
        </tr>
      ))}
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
