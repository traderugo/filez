'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { DEFAULT_PHONE } from '@/lib/defaultAccounts'
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

export default function AccountLedgerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <AccountLedgerContent />
    </Suspense>
  )
}

function AccountLedgerContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)

  // Live data from IndexedDB
  const customers = useLiveQuery(
    () => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [],
    [orgId], []
  )
  const allPayments = useLiveQuery(
    () => orgId ? db.customerPayments.where('orgId').equals(orgId).toArray() : [],
    [orgId], []
  )

  // Filter out default/system accounts
  const creditCustomers = useMemo(
    () => customers.filter(c => c.phone !== DEFAULT_PHONE).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [customers]
  )

  // Build ledger summary per account
  const ledgerData = useMemo(() => {
    if (!creditCustomers.length) return []

    return creditCustomers.map(cust => {
      const custPayments = allPayments.filter(p => p.customerId === cust.id)

      const priorEntries = custPayments.filter(p => p.entryDate < startDate)
      const priorSales = priorEntries.reduce((s, p) => s + (Number(p.salesAmount) || 0), 0)
      const priorPaid = priorEntries.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0)
      const openingBalance = (Number(cust.opening_balance) || 0) + priorSales - priorPaid

      const rangeEntries = custPayments.filter(p => p.entryDate >= startDate && p.entryDate <= endDate)
      const totalDebit = rangeEntries.reduce((s, p) => s + (Number(p.salesAmount) || 0), 0)
      const totalCredit = rangeEntries.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0)
      const closingBalance = openingBalance + totalDebit - totalCredit

      return {
        id: cust.id,
        name: cust.name || 'Unnamed',
        openingBalance,
        closingBalance,
        totalDebit,
        totalCredit,
      }
    })
  }, [creditCustomers, allPayments, startDate, endDate])

  // Grand totals
  const totals = useMemo(() => {
    return ledgerData.reduce((acc, c) => ({
      openingBalance: acc.openingBalance + c.openingBalance,
      totalDebit: acc.totalDebit + c.totalDebit,
      totalCredit: acc.totalCredit + c.totalCredit,
      closingBalance: acc.closingBalance + c.closingBalance,
    }), { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 })
  }, [ledgerData])

  const cell = 'border border-gray-200 px-3 py-1.5 text-sm'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  if (!orgId) return <div className="p-6 text-gray-500">No station selected.</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-lg font-bold mb-4">Account Ledger</h1>

      {/* Controls */}
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

      {creditCustomers.length === 0 && (
        <p className="text-gray-500 text-sm">No credit customers configured.</p>
      )}

      {ledgerData.length > 0 && (
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className={hdr}>
              <th className={cell + ' text-left'}>Account</th>
              <th className={cell + ' text-right'}>Opening Bal</th>
              <th className={cell + ' text-right'}>Debit (Dr)</th>
              <th className={cell + ' text-right'}>Credit (Cr)</th>
              <th className={cell + ' text-right'}>Closing Bal</th>
              <th className={cell + ' w-10'}></th>
            </tr>
          </thead>
          <tbody>
            {ledgerData.map(acct => (
              <tr key={acct.id} className="hover:bg-gray-50 transition-colors">
                <td className={cell + ' font-medium'}>
                  <Link
                    href={`/dashboard/reports/account-ledger/${acct.id}?org_id=${orgId}&from=${startDate}&to=${endDate}`}
                    className="text-blue-600 hover:underline"
                  >
                    {acct.name}
                  </Link>
                </td>
                <td className={cellR}>{fmtBal(acct.openingBalance)}</td>
                <td className={cellR}>{acct.totalDebit ? fmt(acct.totalDebit) : ''}</td>
                <td className={cellR}>{acct.totalCredit ? fmt(acct.totalCredit) : ''}</td>
                <td className={cellR}>{fmtBal(acct.closingBalance)}</td>
                <td className={cell + ' text-center'}>
                  <Link
                    href={`/dashboard/reports/account-ledger/${acct.id}?org_id=${orgId}&from=${startDate}&to=${endDate}`}
                    className="text-gray-400 hover:text-blue-600"
                  >
                    <ChevronRight className="w-4 h-4 inline" />
                  </Link>
                </td>
              </tr>
            ))}
            {/* Totals */}
            <tr className="bg-gray-50 font-bold">
              <td className={cell}>Totals</td>
              <td className={cellR}>{fmtBal(totals.openingBalance)}</td>
              <td className={cellR}>{fmt(totals.totalDebit)}</td>
              <td className={cellR}>{fmt(totals.totalCredit)}</td>
              <td className={cellR}>{fmtBal(totals.closingBalance)}</td>
              <td className={cell}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
