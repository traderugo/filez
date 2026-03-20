'use client'

import { Suspense, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
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

const PAGE_SIZE = 15

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
  const [page, setPage] = useState(0)

  // New account form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBalance, setNewBalance] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const [newError, setNewError] = useState('')

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

  // Build ledger data for ALL accounts (needed for "All" view pagination)
  const allLedgerData = useMemo(() => {
    if (!creditCustomers.length) return []

    return creditCustomers.map(cust => {
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
  }, [creditCustomers, allPayments, startDate, endDate])

  // Single account data
  const singleAccountData = useMemo(() => {
    if (selectedAccount === '__all__') return null
    return allLedgerData.find(d => d.id === selectedAccount) || null
  }, [allLedgerData, selectedAccount])

  // "All" view: sorted by most debt, paginated
  const sortedAll = useMemo(() => {
    return [...allLedgerData].sort((a, b) => b.closingBalance - a.closingBalance)
  }, [allLedgerData])

  const totalPages = Math.ceil(sortedAll.length / PAGE_SIZE)
  const pagedData = useMemo(() => {
    const start = page * PAGE_SIZE
    return sortedAll.slice(start, start + PAGE_SIZE)
  }, [sortedAll, page])

  // Grand totals (all accounts, not just current page)
  const totals = useMemo(() => {
    return allLedgerData.reduce((acc, c) => ({
      openingBalance: acc.openingBalance + c.openingBalance,
      totalDebit: acc.totalDebit + c.totalDebit,
      totalCredit: acc.totalCredit + c.totalCredit,
      closingBalance: acc.closingBalance + c.closingBalance,
    }), { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 })
  }, [allLedgerData])

  // Reset page when switching views
  const handleAccountChange = useCallback((val) => {
    setSelectedAccount(val)
    setPage(0)
  }, [])

  // Create new account
  const handleCreateAccount = async () => {
    const name = newName.trim()
    if (!name) { setNewError('Account name is required'); return }
    if (creditCustomers.some(c => c.name?.toLowerCase() === name.toLowerCase())) {
      setNewError('An account with this name already exists'); return
    }

    setSavingNew(true)
    setNewError('')
    try {
      const newId = crypto.randomUUID()
      const newCustomer = {
        id: newId,
        orgId,
        name,
        phone: newPhone.trim() || null,
        opening_balance: Number(newBalance) || 0,
        opening_date: todayStr,
        sort_order: customers.length,
      }

      // Write to IndexedDB first (offline-first)
      await db.customers.add(newCustomer)

      // Sync to server with all existing customers + new one
      const allCustomers = customers
        .filter(c => c.phone !== DEFAULT_PHONE)
        .map(c => ({ name: c.name, phone: c.phone, opening_balance: c.opening_balance, opening_date: c.opening_date }))
      allCustomers.push({ name, phone: newCustomer.phone, opening_balance: newCustomer.opening_balance, opening_date: newCustomer.opening_date })

      fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, customers: allCustomers }),
      }).catch(() => { /* offline — will sync later */ })

      setNewName('')
      setNewPhone('')
      setNewBalance('')
      setShowNewForm(false)
      setSelectedAccount(newId)
    } catch {
      setNewError('Failed to create account')
    }
    setSavingNew(false)
  }

  const isSingleAccount = selectedAccount !== '__all__'

  const cell = 'border border-gray-200 px-3 py-1.5 text-sm whitespace-nowrap'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  if (!orgId) return <div className="p-6 text-gray-500">No station selected.</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Account Ledger</h1>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700"
          >
            <Plus className="w-4 h-4" /> New Account
          </button>
        )}
      </div>

      {/* New account form */}
      {showNewForm && (
        <div className="border border-gray-300 p-4 mb-4 bg-gray-50">
          <h3 className="text-sm font-semibold mb-3">Create Account</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Account name"
                maxLength={200}
                className="w-full px-2.5 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Optional"
                maxLength={20}
                className="w-full px-2.5 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-gray-500 mb-1">Opening Bal</label>
              <input
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-2.5 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCreateAccount}
              disabled={savingNew}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {savingNew && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewError('') }}
              className="px-4 py-2 border border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
          {newError && <p className="text-sm text-red-600 mt-2">{newError}</p>}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <DateInput value={startDate} onChange={setStartDate} className="w-36 px-2 py-2 border border-gray-300 text-sm font-medium" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <DateInput value={endDate} onChange={setEndDate} className="w-36 px-2 py-2 border border-gray-300 text-sm font-medium" />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
          <SearchableSelect
            value={selectedAccount}
            onChange={handleAccountChange}
            options={accountOptions}
            placeholder="Select account..."
          />
        </div>
      </div>

      {creditCustomers.length === 0 && !showNewForm && (
        <p className="text-gray-500 text-sm">No credit customers configured.</p>
      )}

      {/* Single account — full journal view */}
      {isSingleAccount && singleAccountData && (
        <JournalTable data={singleAccountData} startDate={startDate} endDate={endDate} />
      )}

      {/* All accounts — paginated, each as standalone journal table */}
      {!isSingleAccount && pagedData.length > 0 && (
        <>
          {/* Grand totals summary */}
          <table className="w-full border-collapse border border-gray-200 mb-4">
            <thead>
              <tr className={hdr}>
                <th className={cell + ' text-left'}>All Accounts ({sortedAll.length})</th>
                <th className={cell + ' text-right'}>Opening Bal</th>
                <th className={cell + ' text-right'}>Debit (Dr)</th>
                <th className={cell + ' text-right'}>Credit (Cr)</th>
                <th className={cell + ' text-right'}>Closing Bal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50 font-bold">
                <td className={cell}>Totals</td>
                <td className={cellR}>{fmtBal(totals.openingBalance)}</td>
                <td className={cellR}>{fmt(totals.totalDebit)}</td>
                <td className={cellR}>{fmt(totals.totalCredit)}</td>
                <td className={cellR}>{fmtBal(totals.closingBalance)}</td>
              </tr>
            </tbody>
          </table>

          {/* Per-account journal tables */}
          <div className="space-y-6">
            {pagedData.map(acct => (
              <JournalTable
                key={acct.id}
                data={acct}
                startDate={startDate}
                endDate={endDate}
                onSelect={() => handleAccountChange(acct.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function JournalTable({ data, startDate, endDate, onSelect }) {
  const cell = 'border border-gray-200 px-3 py-1.5 text-sm whitespace-nowrap'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  return (
    <div>
      <h2
        className={`text-sm font-bold mb-2 ${onSelect ? 'text-blue-600 cursor-pointer hover:underline' : ''}`}
        onClick={onSelect}
      >
        {data.name}
      </h2>
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
