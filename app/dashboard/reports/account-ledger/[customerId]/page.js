'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import DateInput from '@/components/DateInput'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtBal(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  if (v < 0) return `(${fmt(Math.abs(v))})`
  return fmt(v)
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AccountDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <AccountDetailContent />
    </Suspense>
  )
}

function AccountDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const customerId = params.customerId
  const orgId = searchParams.get('org_id') || ''

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [startDate, setStartDate] = useState(searchParams.get('from') || monthStartStr)
  const [endDate, setEndDate] = useState(searchParams.get('to') || todayStr)

  // Live data from IndexedDB
  const customer = useLiveQuery(
    () => customerId ? db.customers.get(customerId) : null,
    [customerId], null
  )
  const payments = useLiveQuery(
    () => customerId && orgId
      ? db.customerPayments.where('customerId').equals(customerId).toArray()
      : [],
    [customerId, orgId], []
  )

  // Build journal
  const journal = useMemo(() => {
    if (!customer || !payments) return null

    const priorEntries = payments.filter(p => p.entryDate < startDate)
    const priorSales = priorEntries.reduce((s, p) => s + (Number(p.salesAmount) || 0), 0)
    const priorPaid = priorEntries.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0)
    const openingBalance = (Number(customer.opening_balance) || 0) + priorSales - priorPaid

    const rangeEntries = payments
      .filter(p => p.entryDate >= startDate && p.entryDate <= endDate)
      .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || '') || (a.createdAt || '').localeCompare(b.createdAt || ''))

    let balance = openingBalance
    const rows = rangeEntries.map(entry => {
      const debit = Number(entry.salesAmount) || 0
      const credit = Number(entry.amountPaid) || 0
      balance += debit - credit
      return {
        id: entry.id,
        date: entry.entryDate,
        particulars: entry.notes || (debit && credit ? 'Sales & Payment' : debit ? 'Sales on credit' : credit ? 'Payment received' : ''),
        debit,
        credit,
        balance,
      }
    })

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
    const closingBalance = openingBalance + totalDebit - totalCredit

    return { openingBalance, closingBalance, totalDebit, totalCredit, rows }
  }, [customer, payments, startDate, endDate])

  const cell = 'border border-gray-200 px-3 py-1.5 text-sm'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  if (!orgId) return <div className="p-6 text-gray-500">No station selected.</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back link + title */}
      <div className="mb-4">
        <Link
          href={`/dashboard/reports/account-ledger?org_id=${orgId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> All Accounts
        </Link>
        <h1 className="text-lg font-bold">{customer?.name || 'Loading...'}</h1>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <DateInput value={startDate} onChange={setStartDate} className="w-36" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <DateInput value={endDate} onChange={setEndDate} className="w-36" />
        </div>
      </div>

      {/* Journal table */}
      {!journal ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className={hdr}>
              <th className={cell + ' text-left w-24'}>Date</th>
              <th className={cell + ' text-left'}>Particulars</th>
              <th className={cell + ' text-right w-28'}>Debit (Dr)</th>
              <th className={cell + ' text-right w-28'}>Credit (Cr)</th>
              <th className={cell + ' text-right w-32'}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening balance */}
            <tr className="bg-gray-50 font-semibold">
              <td className={cell}>{fmtDate(startDate)}</td>
              <td className={cell}>Opening Balance</td>
              <td className={cellR}></td>
              <td className={cellR}></td>
              <td className={cellR}>{fmtBal(journal.openingBalance)}</td>
            </tr>

            {/* Transaction rows */}
            {journal.rows.map(row => (
              <tr key={row.id}>
                <td className={cell}>{fmtDate(row.date)}</td>
                <td className={cell}>{row.particulars}</td>
                <td className={cellR}>{row.debit ? fmt(row.debit) : ''}</td>
                <td className={cellR}>{row.credit ? fmt(row.credit) : ''}</td>
                <td className={cellR + ' font-medium'}>{fmtBal(row.balance)}</td>
              </tr>
            ))}

            {journal.rows.length === 0 && (
              <tr>
                <td colSpan={5} className={cell + ' text-center text-gray-400 italic'}>
                  No transactions in this period
                </td>
              </tr>
            )}

            {/* Closing balance */}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
              <td className={cell}>{fmtDate(endDate)}</td>
              <td className={cell}>Closing Balance</td>
              <td className={cellR}>{journal.totalDebit ? fmt(journal.totalDebit) : ''}</td>
              <td className={cellR}>{journal.totalCredit ? fmt(journal.totalCredit) : ''}</td>
              <td className={cellR}>{fmtBal(journal.closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
