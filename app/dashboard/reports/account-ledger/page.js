'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { DEFAULT_PHONE } from '@/lib/defaultAccounts'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'

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
  const [selectedAccount, setSelectedAccount] = useState('__all__')

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

  // Account selector options
  const accountOptions = useMemo(() => [
    { value: '__all__', label: 'All Accounts' },
    ...creditCustomers.map(c => ({ value: c.id, label: c.name || 'Unnamed' })),
  ], [creditCustomers])

  // Build ledger data
  const ledgerData = useMemo(() => {
    if (!creditCustomers.length) return []

    const targetCustomers = selectedAccount === '__all__'
      ? creditCustomers
      : creditCustomers.filter(c => c.id === selectedAccount)

    return targetCustomers.map(cust => {
      const custPayments = allPayments.filter(p => p.customerId === cust.id)

      const priorEntries = custPayments.filter(p => p.entryDate < startDate)
      const priorSales = priorEntries.reduce((s, p) => s + (Number(p.salesAmount) || 0), 0)
      const priorPaid = priorEntries.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0)
      const openingBalance = (Number(cust.opening_balance) || 0) + priorSales - priorPaid

      const rangeEntries = custPayments
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

      return {
        id: cust.id,
        name: cust.name || 'Unnamed',
        openingBalance,
        closingBalance,
        totalDebit,
        totalCredit,
        rows,
      }
    })
  }, [creditCustomers, allPayments, selectedAccount, startDate, endDate])

  // Grand totals
  const totals = useMemo(() => {
    return ledgerData.reduce((acc, c) => ({
      openingBalance: acc.openingBalance + c.openingBalance,
      totalDebit: acc.totalDebit + c.totalDebit,
      totalCredit: acc.totalCredit + c.totalCredit,
      closingBalance: acc.closingBalance + c.closingBalance,
    }), { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 })
  }, [ledgerData])

  const isSingleAccount = selectedAccount !== '__all__'

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
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
          <SearchableSelect
            value={selectedAccount}
            onChange={setSelectedAccount}
            options={accountOptions}
            placeholder="Select account..."
          />
        </div>
      </div>

      {creditCustomers.length === 0 && (
        <p className="text-gray-500 text-sm">No credit customers configured.</p>
      )}

      {/* Single account — full journal view */}
      {isSingleAccount && ledgerData.length > 0 && (
        <JournalTable data={ledgerData[0]} startDate={startDate} endDate={endDate} />
      )}

      {/* All accounts — summary table, click to select */}
      {!isSingleAccount && ledgerData.length > 0 && (
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className={hdr}>
              <th className={cell + ' text-left'}>Account</th>
              <th className={cell + ' text-right'}>Opening Bal</th>
              <th className={cell + ' text-right'}>Debit (Dr)</th>
              <th className={cell + ' text-right'}>Credit (Cr)</th>
              <th className={cell + ' text-right'}>Closing Bal</th>
            </tr>
          </thead>
          <tbody>
            {ledgerData.map(acct => (
              <tr
                key={acct.id}
                className="cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => setSelectedAccount(acct.id)}
              >
                <td className={cell + ' font-medium text-blue-600'}>{acct.name}</td>
                <td className={cellR}>{fmtBal(acct.openingBalance)}</td>
                <td className={cellR}>{acct.totalDebit ? fmt(acct.totalDebit) : ''}</td>
                <td className={cellR}>{acct.totalCredit ? fmt(acct.totalCredit) : ''}</td>
                <td className={cellR}>{fmtBal(acct.closingBalance)}</td>
              </tr>
            ))}
            {/* Totals */}
            <tr className="bg-gray-50 font-bold">
              <td className={cell}>Totals</td>
              <td className={cellR}>{fmtBal(totals.openingBalance)}</td>
              <td className={cellR}>{fmt(totals.totalDebit)}</td>
              <td className={cellR}>{fmt(totals.totalCredit)}</td>
              <td className={cellR}>{fmtBal(totals.closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

function JournalTable({ data, startDate, endDate }) {
  const cell = 'border border-gray-200 px-3 py-1.5 text-sm'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  return (
    <div>
      <h2 className="text-sm font-bold mb-2">{data.name}</h2>
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
            <td className={cellR}>{fmtBal(data.openingBalance)}</td>
          </tr>

          {/* Transaction rows */}
          {data.rows.map(row => (
            <tr key={row.id}>
              <td className={cell}>{fmtDate(row.date)}</td>
              <td className={cell}>{row.particulars}</td>
              <td className={cellR}>{row.debit ? fmt(row.debit) : ''}</td>
              <td className={cellR}>{row.credit ? fmt(row.credit) : ''}</td>
              <td className={cellR + ' font-medium'}>{fmtBal(row.balance)}</td>
            </tr>
          ))}

          {data.rows.length === 0 && (
            <tr>
              <td colSpan={5} className={cell + ' text-center text-gray-400 italic'}>
                No transactions in this period
              </td>
            </tr>
          )}

          {/* Closing balance / totals */}
          <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
            <td className={cell}>{fmtDate(endDate)}</td>
            <td className={cell}>Closing Balance</td>
            <td className={cellR}>{data.totalDebit ? fmt(data.totalDebit) : ''}</td>
            <td className={cellR}>{data.totalCredit ? fmt(data.totalCredit) : ''}</td>
            <td className={cellR}>{fmtBal(data.closingBalance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
