'use client'

import { Suspense, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { db } from '@/lib/db'
import { DEFAULT_PHONE } from '@/lib/defaultAccounts'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'
import { fmtDate } from '@/lib/formatDate'

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
  const [selectedAccounts, setSelectedAccounts] = useState([])
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

  // Labels for selected accounts
  const selectedLabels = useMemo(() => {
    return selectedAccounts.map(id => {
      const c = creditCustomers.find(c => c.id === id)
      return { id, name: c?.name || 'Unnamed' }
    })
  }, [selectedAccounts, creditCustomers])

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

  // Selected accounts data
  const selectedData = useMemo(() => {
    return selectedAccounts.map(id => allLedgerData.find(d => d.id === id)).filter(Boolean)
  }, [allLedgerData, selectedAccounts])

  // Multi-account merged journal
  const mergedJournal = useMemo(() => {
    if (selectedData.length < 2) return null
    const combinedOpening = selectedData.reduce((s, d) => s + d.openingBalance, 0)
    const allRows = selectedData.flatMap(d =>
      d.rows.map(r => ({ ...r, account: d.name }))
    ).sort((x, y) => (x.date || '').localeCompare(y.date || '') || (x.id || '').localeCompare(y.id || ''))

    let balance = combinedOpening
    const rows = allRows.map(r => {
      balance += r.debit - r.credit
      return { ...r, balance }
    })

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

    return {
      names: selectedData.map(d => d.name),
      openingBalance: combinedOpening,
      closingBalance: combinedOpening + totalDebit - totalCredit,
      totalDebit,
      totalCredit,
      rows,
    }
  }, [selectedData])

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

  // Toggle account selection (max 10)
  const handleAccountChange = useCallback((val) => {
    if (val === '__all__') {
      setSelectedAccounts([])
      setPage(0)
      return
    }
    setSelectedAccounts(prev => {
      if (prev.includes(val)) return prev.filter(id => id !== val)
      if (prev.length >= 10) return [...prev.slice(1), val]
      return [...prev, val]
    })
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
      setSelectedAccounts([newId])
    } catch {
      setNewError('Failed to create account')
    }
    setSavingNew(false)
  }

  const cell = 'border border-gray-200 px-3 py-1.5 text-sm whitespace-nowrap'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  if (!orgId) return <div className="p-6 text-gray-500">No station selected.</div>

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-5xl mx-auto px-4 sm:px-6">
      <div className="shrink-0 pt-4 flex items-center justify-between mb-4">
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
      <div className="shrink-0 flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <DateInput value={startDate} onChange={setStartDate} className="w-36 px-2 py-2 border border-gray-300 text-sm font-medium" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <DateInput value={endDate} onChange={setEndDate} className="w-36 px-2 py-2 border border-gray-300 text-sm font-medium" />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Account (select up to 10)</label>
          <SearchableSelect
            value={selectedAccounts.length === 0 ? '__all__' : ''}
            onChange={handleAccountChange}
            options={accountOptions}
            placeholder="Select account..."
          />
          {selectedLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedLabels.map(s => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 cursor-pointer hover:bg-blue-200"
                  onClick={() => handleAccountChange(s.id)}
                >
                  {s.name}
                  <X className="w-3 h-3" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 pb-4 border border-gray-200">
        {creditCustomers.length === 0 && !showNewForm && (
          <p className="text-gray-500 text-sm p-4">No credit customers configured.</p>
        )}

        {/* Multiple accounts — merged journal */}
        {selectedAccounts.length >= 2 && mergedJournal && (
          <MergedJournalTable data={mergedJournal} startDate={startDate} endDate={endDate} />
        )}

        {/* Single account — full journal view */}
        {selectedAccounts.length === 1 && selectedData[0] && (
          <JournalTable data={selectedData[0]} startDate={startDate} endDate={endDate} />
        )}

        {/* All accounts — simple clickable list */}
        {selectedAccounts.length === 0 && pagedData.length > 0 && (
          <div className="p-2">
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

            {/* Account list */}
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-100 text-sm font-semibold">
                  <th className={cell + ' text-left'}>Account</th>
                  <th className={cell + ' text-right'}>Opening Bal</th>
                  <th className={cell + ' text-right'}>Debit (Dr)</th>
                  <th className={cell + ' text-right'}>Credit (Cr)</th>
                  <th className={cell + ' text-right'}>Closing Bal</th>
                </tr>
              </thead>
              <tbody>
                {pagedData.map(acct => (
                  <tr
                    key={acct.id}
                    onClick={() => handleAccountChange(acct.id)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className={cell + ' text-blue-600 font-medium'}>{acct.name}</td>
                    <td className={cellR}>{fmtBal(acct.openingBalance)}</td>
                    <td className={cellR}>{acct.totalDebit ? fmt(acct.totalDebit) : ''}</td>
                    <td className={cellR}>{acct.totalCredit ? fmt(acct.totalCredit) : ''}</td>
                    <td className={cellR + ' font-medium'}>{fmtBal(acct.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

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
          </div>
        )}
      </div>
    </div>
  )
}

function JournalTable({ data, startDate, endDate }) {
  const cell = 'border border-gray-200 px-3 py-1.5 text-sm whitespace-nowrap'
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
            <td className={`${cellR} whitespace-nowrap`}>{fmtDate(startDate)}</td>
            <td className={cell}>Opening Balance</td>
            <td className={cellR}></td>
            <td className={cellR}></td>
            <td className={cellR}>{fmtBal(data.openingBalance)}</td>
          </tr>

          {/* Transaction rows */}
          {data.rows.map(row => (
            <tr key={row.id}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
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
            <td className={`${cellR} whitespace-nowrap`}>{fmtDate(endDate)}</td>
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

function MergedJournalTable({ data, startDate, endDate }) {
  const [page, setPage] = useState(0)
  const cell = 'border border-gray-200 px-3 py-1.5 text-sm whitespace-nowrap'
  const cellR = cell + ' text-right'
  const hdr = 'bg-blue-600 text-white font-bold text-sm'

  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE)
  const pagedRows = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <h2 className="text-sm font-bold mb-2">
        {data.names.length <= 3 ? data.names.join(' & ') : `${data.names.slice(0, 3).join(', ')} + ${data.names.length - 3} more`}
      </h2>
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className={hdr}>
            <th className={cell + ' text-left w-24'}>Date</th>
            <th className={cell + ' text-left'}>Account</th>
            <th className={cell + ' text-left'}>Particulars</th>
            <th className={cell + ' text-right w-28'}>Debit (Dr)</th>
            <th className={cell + ' text-right w-28'}>Credit (Cr)</th>
            <th className={cell + ' text-right w-32'}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {page === 0 && (
            <tr className="bg-gray-50 font-semibold">
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(startDate)}</td>
              <td className={cell}></td>
              <td className={cell}>Opening Balance</td>
              <td className={cellR}></td>
              <td className={cellR}></td>
              <td className={cellR}>{fmtBal(data.openingBalance)}</td>
            </tr>
          )}

          {pagedRows.map((row, i) => (
            <tr key={`${row.id}-${i}`}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              <td className={cell + ' text-xs text-gray-500'}>{row.account}</td>
              <td className={cell}>{row.particulars}</td>
              <td className={cellR}>{row.debit ? fmt(row.debit) : ''}</td>
              <td className={cellR}>{row.credit ? fmt(row.credit) : ''}</td>
              <td className={cellR + ' font-medium'}>{fmtBal(row.balance)}</td>
            </tr>
          ))}

          {data.rows.length === 0 && (
            <tr>
              <td colSpan={6} className={cell + ' text-center text-gray-400 italic'}>
                No transactions in this period
              </td>
            </tr>
          )}

          {page === totalPages - 1 && (
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(endDate)}</td>
              <td className={cell}></td>
              <td className={cell}>Closing Balance</td>
              <td className={cellR}>{data.totalDebit ? fmt(data.totalDebit) : ''}</td>
              <td className={cellR}>{data.totalCredit ? fmt(data.totalCredit) : ''}</td>
              <td className={cellR}>{fmtBal(data.closingBalance)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
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
    </div>
  )
}
