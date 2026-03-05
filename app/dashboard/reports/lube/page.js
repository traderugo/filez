'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const TABS = ['Daily Log', 'Inventory']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function LubeReportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab] = useState('Daily Log')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/lube?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { if (d.products) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1)
  }

  return (
    <div className="max-w-full px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Lube Logs</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data ? (
        <p className="text-sm text-gray-500">Failed to load report.</p>
      ) : (
        <div className="overflow-x-auto">
          {tab === 'Daily Log' && <DailyLogTab data={data} />}
          {tab === 'Inventory' && <InventoryTab data={data} />}
        </div>
      )}
    </div>
  )
}

function getDailyForDate(data, day) {
  const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return data.daily.find((d) => d.entry_date === dateStr)
}

function n(val) { return Number(val) || 0 }
function fmt(val) { return n(val).toLocaleString() }
function fmtCurrency(val) { return n(val).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) }

const thClass = 'px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 whitespace-nowrap'
const tdClass = 'px-2 py-1.5 text-xs text-gray-900 border border-gray-200 text-right font-mono'
const tdLabelClass = 'px-2 py-1.5 text-xs text-gray-700 border border-gray-200 whitespace-nowrap'
const tdTotalClass = 'px-2 py-1.5 text-xs font-bold text-gray-900 border border-gray-200 text-right font-mono bg-gray-50'

// ============================================
// DAILY LOG TAB
// ============================================
// Mirrors left side of Excel: Date | Product Sold | Qty Out | Amount | Lodgement | Balance | Received
function DailyLogTab({ data }) {
  const { products, daysInMonth } = data

  const rows = useMemo(() => {
    const result = []
    let runningBalance = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const daily = getDailyForDate(data, day)
      if (!daily) continue

      const dayTx = data.transactions.filter((t) => t.daily_id === daily.id)
      const sales = dayTx.filter((t) => t.tx_type === 'sale')
      const received = dayTx.filter((t) => t.tx_type === 'received')

      // Group sales by product for this day
      const salesByProduct = {}
      sales.forEach((tx) => {
        if (!salesByProduct[tx.product_id]) salesByProduct[tx.product_id] = 0
        salesByProduct[tx.product_id] += n(tx.quantity)
      })

      // Calculate daily totals
      let dayAmount = 0
      const saleEntries = []
      Object.entries(salesByProduct).forEach(([productId, qty]) => {
        const product = products.find((p) => p.id === productId)
        if (!product) return
        const amount = qty * n(product.unit_price)
        dayAmount += amount
        saleEntries.push({ productName: product.product_name, qty, amount })
      })

      const totalReceived = received.reduce((s, t) => s + n(t.quantity), 0)
      const lodgement = n(daily.lodgement)

      runningBalance += dayAmount - lodgement

      result.push({
        day,
        date: `${day}-${data.month}-${data.year}`,
        saleEntries,
        totalAmount: dayAmount,
        lodgement,
        balance: runningBalance,
        received: totalReceived,
      })
    }
    return result
  }, [data, daysInMonth, products])

  const totals = useMemo(() => ({
    totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
    lodgement: rows.reduce((s, r) => s + r.lodgement, 0),
    received: rows.reduce((s, r) => s + r.received, 0),
  }), [rows])

  return (
    <table className="border-collapse w-full">
      <thead>
        <tr>
          <th className={thClass}>Day</th>
          <th className={thClass}>Date</th>
          <th className={thClass}>Product Sold</th>
          <th className={thClass}>Qty Out</th>
          <th className={thClass}>Amount</th>
          <th className={thClass}>Lodgement</th>
          <th className={thClass}>Balance</th>
          <th className={thClass}>Received</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8} className={`${tdLabelClass} text-center text-gray-400 py-8`}>No entries for this month</td>
          </tr>
        ) : rows.map((row) => {
          if (row.saleEntries.length === 0) {
            return (
              <tr key={row.day}>
                <td className={tdLabelClass}>{row.day}</td>
                <td className={tdLabelClass}>{row.date}</td>
                <td className={tdLabelClass}>—</td>
                <td className={tdClass}>—</td>
                <td className={tdClass}>{fmt(row.totalAmount)}</td>
                <td className={tdClass}>{fmt(row.lodgement)}</td>
                <td className={`${tdClass} ${row.balance < 0 ? 'text-red-600' : ''}`}>{fmt(row.balance)}</td>
                <td className={tdClass}>{row.received > 0 ? fmt(row.received) : '—'}</td>
              </tr>
            )
          }
          // Multiple products sold in one day: first row has day/date, rest are sub-rows
          return row.saleEntries.map((entry, i) => (
            <tr key={`${row.day}-${i}`}>
              {i === 0 ? (
                <>
                  <td className={tdLabelClass} rowSpan={row.saleEntries.length}>{row.day}</td>
                  <td className={tdLabelClass} rowSpan={row.saleEntries.length}>{row.date}</td>
                </>
              ) : null}
              <td className={tdLabelClass}>{entry.productName}</td>
              <td className={tdClass}>{entry.qty}</td>
              {i === 0 ? (
                <>
                  <td className={tdClass} rowSpan={row.saleEntries.length}>{fmt(row.totalAmount)}</td>
                  <td className={tdClass} rowSpan={row.saleEntries.length}>{fmt(row.lodgement)}</td>
                  <td className={`${tdClass} ${row.balance < 0 ? 'text-red-600' : ''}`} rowSpan={row.saleEntries.length}>{fmt(row.balance)}</td>
                  <td className={tdClass} rowSpan={row.saleEntries.length}>{row.received > 0 ? fmt(row.received) : '—'}</td>
                </>
              ) : null}
            </tr>
          ))
        })}
        {rows.length > 0 && (
          <tr className="font-bold">
            <td colSpan={4} className={tdTotalClass}>TOTAL</td>
            <td className={tdTotalClass}>{fmt(totals.totalAmount)}</td>
            <td className={tdTotalClass}>{fmt(totals.lodgement)}</td>
            <td className={tdTotalClass}></td>
            <td className={tdTotalClass}>{fmt(totals.received)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// ============================================
// INVENTORY TAB
// ============================================
// Mirrors right side of Excel: SN | Product | Opening Stock | Sales Qty | Amount | Received | Expected Closing | Actual Closing | Variance
function InventoryTab({ data }) {
  const { products, daysInMonth } = data

  const rows = useMemo(() => {
    return products.map((product, idx) => {
      const stockEntry = data.monthlyStock.find((s) => s.product_id === product.id)
      const opening = n(stockEntry?.opening_stock)

      // Sum all sales for this product in the month
      const salesQty = data.transactions
        .filter((t) => t.product_id === product.id && t.tx_type === 'sale')
        .reduce((s, t) => s + n(t.quantity), 0)

      // Sum all received for this product
      const receivedQty = data.transactions
        .filter((t) => t.product_id === product.id && t.tx_type === 'received')
        .reduce((s, t) => s + n(t.quantity), 0)

      const amount = salesQty * n(product.unit_price)
      const expectedClosing = opening - salesQty + receivedQty
      // For actual closing, we'd need it stored separately; for now use expected
      // (data entry form will add actual_closing to lube_monthly_stock later)
      const actualClosing = expectedClosing
      const variance = actualClosing - expectedClosing

      return {
        sn: idx + 1,
        productName: product.product_name,
        unitPrice: n(product.unit_price),
        opening,
        salesQty,
        amount,
        receivedQty,
        expectedClosing,
        actualClosing,
        variance,
      }
    })
  }, [data, products, daysInMonth])

  const totals = useMemo(() => ({
    salesQty: rows.reduce((s, r) => s + r.salesQty, 0),
    amount: rows.reduce((s, r) => s + r.amount, 0),
    receivedQty: rows.reduce((s, r) => s + r.receivedQty, 0),
  }), [rows])

  return (
    <table className="border-collapse w-full">
      <thead>
        <tr>
          <th className={thClass}>S/N</th>
          <th className={thClass}>Product</th>
          <th className={thClass}>Unit Price</th>
          <th className={thClass}>Opening Stock</th>
          <th className={thClass}>Sales Qty</th>
          <th className={thClass}>Amount</th>
          <th className={thClass}>Received</th>
          <th className={thClass}>Expected Closing</th>
          <th className={thClass}>Actual Closing</th>
          <th className={thClass}>Variance</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={10} className={`${tdLabelClass} text-center text-gray-400 py-8`}>No lube products configured</td>
          </tr>
        ) : rows.map((row) => (
          <tr key={row.sn}>
            <td className={tdLabelClass}>{row.sn}</td>
            <td className={tdLabelClass}>{row.productName}</td>
            <td className={tdClass}>{fmtCurrency(row.unitPrice)}</td>
            <td className={tdClass}>{row.opening}</td>
            <td className={tdClass}>{row.salesQty}</td>
            <td className={tdClass}>{fmtCurrency(row.amount)}</td>
            <td className={tdClass}>{row.receivedQty}</td>
            <td className={tdClass}>{row.expectedClosing}</td>
            <td className={tdClass}>{row.expectedClosing}</td>
            <td className={`${tdClass} ${row.variance !== 0 ? 'text-red-600' : ''}`}>{row.variance}</td>
          </tr>
        ))}
        {rows.length > 0 && (
          <tr className="font-bold">
            <td colSpan={4} className={tdTotalClass}>TOTAL</td>
            <td className={tdTotalClass}>{totals.salesQty}</td>
            <td className={tdTotalClass}>{fmtCurrency(totals.amount)}</td>
            <td className={tdTotalClass}>{totals.receivedQty}</td>
            <td colSpan={3} className={tdTotalClass}></td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
