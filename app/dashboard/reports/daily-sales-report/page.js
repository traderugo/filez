'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { initialSync } from '@/lib/initialSync'

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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  // Report data
  const [report, setReport] = useState(null)

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

      setNozzles(noz)
      setTanks(tnk)
      setBanks(bnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  const buildReport = useCallback(async () => {
    if (!orgId || !nozzles.length) return

    // Get all daily sales entries sorted by date ascending
    const allEntries = await db.dailySales
      .where('orgId').equals(orgId)
      .toArray()
    allEntries.sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

    // Find the entry for selected date and the previous entry
    const currentEntry = allEntries.find(e => e.entryDate === date) || null
    const currentIdx = currentEntry ? allEntries.indexOf(currentEntry) : -1
    let prevEntry = null
    if (currentIdx > 0) {
      prevEntry = allEntries[currentIdx - 1]
    } else if (!currentEntry) {
      // No entry for this date — find the most recent entry before this date
      for (let i = allEntries.length - 1; i >= 0; i--) {
        if (allEntries[i].entryDate < date) {
          prevEntry = allEntries[i]
          break
        }
      }
    }

    // Build nozzle rows grouped by fuel type
    const fuelTypes = [...new Set(nozzles.map(n => n.fuel_type))]
    const nozzleRows = []
    const fuelTotals = {}

    for (const ft of fuelTypes) {
      const ftNozzles = nozzles.filter(n => n.fuel_type === ft)
      let ftDispensed = 0
      let ftConsumed = 0
      let ftActual = 0
      let ftAmount = 0
      let price = 0

      if (currentEntry?.prices) {
        price = Number(currentEntry.prices[ft]) || 0
      }

      const rows = ftNozzles.map(n => {
        // Closing from current entry (or opening if no entry — holiday)
        const currentReadings = currentEntry?.nozzleReadings || []
        const currentR = currentReadings.find(r => r.pump_id === n.id)

        // Opening: from previous entry's closing, or config initial_reading
        const prevReadings = prevEntry?.nozzleReadings || []
        const prevR = prevReadings.find(r => r.pump_id === n.id)
        const opening = prevR ? Number(prevR.closing_meter || 0) : Number(n.initial_reading || 0)

        // If no entry for this date, closing = opening (holiday)
        const closing = currentR ? Number(currentR.closing_meter || 0) : opening
        const consumption = currentR ? Number(currentR.consumption || 0) : 0
        const pourBack = currentR ? Number(currentR.pour_back || 0) : 0
        const dispensed = closing - opening
        const actual = dispensed - consumption

        ftDispensed += dispensed
        ftConsumed += consumption
        ftActual += actual

        return {
          label: `${ft} ${n.pump_number}`,
          opening,
          closing,
          dispensed,
          consumption,
          actual,
          pourBack,
        }
      })

      ftAmount = ftActual * price

      fuelTotals[ft] = {
        dispensed: ftDispensed,
        consumed: ftConsumed,
        actual: ftActual,
        price,
        amount: ftAmount,
        pourBack: rows.reduce((s, r) => s + r.pourBack, 0),
      }

      nozzleRows.push({ fuelType: ft, rows, totals: fuelTotals[ft] })
    }

    // Build tank rows
    const tankRows = []
    const tanksByFuel = {}

    for (const ft of fuelTypes) {
      const ftTanks = tanks.filter(t => t.fuel_type === ft)
      tanksByFuel[ft] = { tanks: [], totalOpening: 0, totalClosing: 0, totalWaybill: 0, totalActualSupply: 0 }

      for (const t of ftTanks) {
        const currentTankReadings = currentEntry?.tankReadings || []
        const currentTR = currentTankReadings.find(r => r.tank_id === t.id)

        const prevTankReadings = prevEntry?.tankReadings || []
        const prevTR = prevTankReadings.find(r => r.tank_id === t.id)
        const opening = prevTR ? Number(prevTR.closing_stock || 0) : Number(t.opening_stock || 0)
        const closing = currentTR ? Number(currentTR.closing_stock || 0) : opening

        tanksByFuel[ft].totalOpening += opening
        tanksByFuel[ft].totalClosing += closing

        tanksByFuel[ft].tanks.push({
          label: `${ft} ${t.tank_number}`,
          opening,
          closing,
        })
      }
    }

    // Get product receipts for this date (waybill supply)
    const allReceipts = await db.productReceipts
      .where('orgId').equals(orgId)
      .toArray()
    const todayReceipts = allReceipts.filter(r => r.entryDate === date)

    // Sum waybill and actual supply per tank
    for (const receipt of todayReceipts) {
      const tankConfig = tanks.find(t => t.id === receipt.tankId)
      if (tankConfig && tanksByFuel[tankConfig.fuel_type]) {
        const waybill = Number(receipt.actualVolume) || 0
        tanksByFuel[tankConfig.fuel_type].totalWaybill += waybill
        tanksByFuel[tankConfig.fuel_type].totalActualSupply += waybill
      }
    }

    // Compute stock summary per fuel type
    for (const ft of fuelTypes) {
      const tb = tanksByFuel[ft]
      const dispensed = fuelTotals[ft]?.dispensed || 0
      tb.difference = tb.totalClosing - tb.totalOpening - tb.totalActualSupply
      tb.dispensed = dispensed
      tb.ovsh = tb.difference + dispensed // OV/SH = difference + dispensed (negative = shortage)
    }

    // Also build a "Total" row if PMS has multiple tanks
    const tankSummaryRows = fuelTypes.map(ft => {
      const tb = tanksByFuel[ft]
      return {
        fuelType: ft,
        tanks: tb.tanks,
        opening: tb.totalOpening,
        waybillSupply: tb.totalWaybill,
        actualSupply: tb.totalActualSupply,
        closing: tb.totalClosing,
        difference: tb.totalClosing - tb.totalOpening,
        dispensed: fuelTotals[ft]?.dispensed || 0,
        ovsh: (tb.totalClosing - tb.totalOpening) - (-(fuelTotals[ft]?.dispensed || 0)) + (tb.totalActualSupply),
      }
    })

    // Recalculate OV/SH properly:
    // Closing - Opening = net change
    // Expected change = Supply - Dispensed
    // OV/SH = (Closing - Opening) - (Supply - Dispensed)  =  (Closing - Opening) - Supply + Dispensed
    for (const row of tankSummaryRows) {
      row.ovsh = (row.closing - row.opening) - row.actualSupply + row.dispensed
    }

    // Get lodgements for this date (POS)
    const allLodgements = await db.lodgements
      .where('orgId').equals(orgId)
      .toArray()
    const todayLodgements = allLodgements.filter(l => l.entryDate === date)

    const posEntries = []
    const bankMap = {}
    for (const b of banks) {
      bankMap[b.id] = b
    }
    for (const l of todayLodgements) {
      const bank = bankMap[l.bankId]
      posEntries.push({
        bankName: bank?.bank_name || 'Unknown',
        lodgementType: l.lodgementType || bank?.lodgement_type || '',
        amount: Number(l.amount) || 0,
      })
    }

    const totalPOS = posEntries
      .filter(p => p.lodgementType === 'pos')
      .reduce((s, p) => s + p.amount, 0)

    // Get consumption for this date
    const allConsumption = await db.consumption
      .where('orgId').equals(orgId)
      .toArray()
    const todayConsumption = allConsumption.filter(c => c.entryDate === date)

    // Summary
    const totalSales = fuelTypes.reduce((s, ft) => s + (fuelTotals[ft]?.amount || 0), 0)
    const totalCash = totalSales - totalPOS

    setReport({
      nozzleRows,
      fuelTotals,
      fuelTypes,
      tankSummaryRows,
      tanksByFuel,
      posEntries,
      totalPOS,
      todayConsumption,
      totalSales,
      totalCash,
      hasEntry: !!currentEntry,
    })
  }, [orgId, date, nozzles, tanks, banks])

  useEffect(() => {
    if (!loading) buildReport()
  }, [loading, buildReport])

  const changeDate = (delta) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
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

  const qs = `org_id=${orgId}`

  return (
    <div className="max-w-[1200px] px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-900">Daily Sales Operation Report</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-1.5 border border-gray-300 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => changeDate(1)} className="p-1.5 border border-gray-300 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!report?.hasEntry && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 mb-4 text-base text-yellow-800">
          No entry found for this date. Showing carried-forward values.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== LEFT: DAILY SALES OPERATION ===== */}
        <div className="min-w-0">
          <div className="bg-blue-700 text-white px-3 py-2 text-sm font-semibold">
            DAILY SALES OPERATION
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-blue-200 text-sm">
              <thead>
                <tr className="bg-blue-100 text-blue-900">
                  <th className="border border-blue-200 px-1.5 py-1.5 text-left font-semibold whitespace-nowrap">Pumps</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Opening</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Closing</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Dispensed</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Consumed</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Actual</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Price</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report?.nozzleRows.map(({ fuelType, rows, totals }) => (
                  <FuelGroup
                    key={fuelType}
                    fuelType={fuelType}
                    rows={rows}
                    totals={totals}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit entry links */}
          <div className="mt-4 border border-blue-200">
            <div className="bg-blue-600 text-white px-3 py-2 text-sm font-semibold">EDIT ENTRIES</div>
            <div className="divide-y divide-gray-200">
              <Link href={`/dashboard/entries/daily-sales?${qs}`} className="block px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">Daily Sales Operation</Link>
              <Link href={`/dashboard/entries/product-receipt?${qs}`} className="block px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">Product Receipt</Link>
              <Link href={`/dashboard/entries/lodgements?${qs}`} className="block px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">Lodgements</Link>
              <Link href={`/dashboard/entries/consumption?${qs}`} className="block px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">Consumption</Link>
            </div>
          </div>
        </div>

        {/* ===== RIGHT: STOCK & SUMMARY ===== */}
        <div className="min-w-0">
          <div className="bg-blue-700 text-white px-3 py-2 text-sm font-semibold">
            STOCK &amp; SUMMARY
          </div>

          {/* Tank stock table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-blue-200 text-sm mb-4">
              <thead>
                <tr className="bg-blue-100 text-blue-900">
                  <th className="border border-blue-200 px-1.5 py-1.5 text-left font-semibold whitespace-nowrap">Tank</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Opening</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Supply</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Closing</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Dispensed</th>
                  <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">OV/SH</th>
                </tr>
              </thead>
              <tbody>
                {report?.tankSummaryRows.map((row) => (
                  <TankRow key={row.fuelType} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {/* POS & Consumption side by side */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* POS */}
            <div>
              <div className="bg-blue-600 text-white px-3 py-1.5 text-sm font-semibold border border-blue-200 border-b-0">POS</div>
              <table className="w-full border-collapse border border-blue-200 text-sm">
                <tbody>
                  {report?.posEntries.filter(p => p.lodgementType === 'pos').map((p, i) => (
                    <tr key={i}>
                      <td className="border border-blue-200 px-1.5 py-1.5">{p.bankName}</td>
                      <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(p.amount)}</td>
                    </tr>
                  ))}
                  {(!report?.posEntries.filter(p => p.lodgementType === 'pos').length) && (
                    <tr><td colSpan={2} className="border border-blue-200 px-1.5 py-1.5 text-gray-400">No POS entries</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Consumption */}
            <div>
              <div className="bg-blue-600 text-white px-3 py-1.5 text-sm font-semibold border border-blue-200 border-b-0">Consumption</div>
              <table className="w-full border-collapse border border-blue-200 text-sm">
                <tbody>
                  {report?.todayConsumption.map((c, i) => (
                    <tr key={i}>
                      <td className="border border-blue-200 px-1.5 py-1.5">{c.fuelType || ''}</td>
                      <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(c.quantity)}</td>
                    </tr>
                  ))}
                  {(!report?.todayConsumption?.length) && (
                    <tr><td colSpan={2} className="border border-blue-200 px-1.5 py-1.5 text-gray-400">No consumption</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-blue-600 text-white px-3 py-1.5 text-sm font-semibold border border-blue-200 border-b-0">Summary</div>
          <table className="w-full border-collapse border border-blue-200 text-sm">
            <thead>
              <tr className="bg-blue-50 text-blue-900">
                <th className="border border-blue-200 px-1.5 py-1.5 text-left font-semibold"></th>
                <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold">P/b</th>
                <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold">Sales</th>
                <th className="border border-blue-200 px-1.5 py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {report?.fuelTypes.map(ft => (
                <tr key={ft}>
                  <td className="border border-blue-200 px-1.5 py-1.5 font-medium">{ft}</td>
                  <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(report.fuelTotals[ft]?.pourBack)}</td>
                  <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(report.fuelTotals[ft]?.actual)}</td>
                  <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(report.fuelTotals[ft]?.amount)}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td colSpan={3} className="border border-blue-200 px-1.5 py-1.5">SALES</td>
                <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(report?.totalSales)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className="border border-blue-200 px-1.5 py-1.5">POS</td>
                <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(report?.totalPOS)}</td>
              </tr>
              <tr className="bg-blue-50 font-bold">
                <td colSpan={3} className="border border-blue-200 px-1.5 py-1.5">CASH</td>
                <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(report?.totalCash)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Renders a fuel type group (e.g. all PMS nozzles + subtotal row) */
function FuelGroup({ fuelType, rows, totals }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.label}>
          <td className="border border-blue-200 px-1.5 py-1.5 font-medium whitespace-nowrap">{r.label}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(r.opening)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(r.closing)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(r.dispensed)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(r.consumption)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
        </tr>
      ))}
      {/* Subtotal row */}
      <tr className="bg-blue-50 font-bold">
        <td className="border border-blue-200 px-1.5 py-1.5"></td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(totals.dispensed)}</td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(totals.consumed)}</td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(totals.actual)}</td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(totals.price)}</td>
        <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(totals.amount)}</td>
      </tr>
    </>
  )
}

/** Renders tank summary rows for a fuel type */
function TankRow({ row }) {
  const ovshColor = row.ovsh < 0 ? 'text-red-600' : row.ovsh > 0 ? 'text-green-600' : ''

  return (
    <>
      {row.tanks.length > 1 ? (
        <>
          {row.tanks.map((t) => (
            <tr key={t.label}>
              <td className="border border-blue-200 px-1.5 py-1.5 font-medium whitespace-nowrap">{t.label}</td>
              <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(t.opening)}</td>
              <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
              <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(t.closing)}</td>
              <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
              <td className="border border-blue-200 px-1.5 py-1.5 text-right"></td>
            </tr>
          ))}
          <tr className="bg-blue-50 font-bold">
            <td className="border border-blue-200 px-1.5 py-1.5">Total</td>
            <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.opening)}</td>
            <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.actualSupply)}</td>
            <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.closing)}</td>
            <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.dispensed)}</td>
            <td className={`border border-blue-200 px-1.5 py-1.5 text-right font-bold ${ovshColor}`}>
              {row.ovsh > 0 ? '+' : ''}{fmt(row.ovsh)}
            </td>
          </tr>
        </>
      ) : (
        <tr>
          <td className="border border-blue-200 px-1.5 py-1.5 font-medium whitespace-nowrap">{row.fuelType}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.opening)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.actualSupply)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.closing)}</td>
          <td className="border border-blue-200 px-1.5 py-1.5 text-right">{fmt(row.dispensed)}</td>
          <td className={`border border-blue-200 px-1.5 py-1.5 text-right font-bold ${ovshColor}`}>
            {row.ovsh > 0 ? '+' : ''}{fmt(row.ovsh)}
          </td>
        </tr>
      )}
    </>
  )
}
