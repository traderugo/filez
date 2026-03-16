'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { customerPaymentsRepo } from '@/lib/repositories/customerPayments'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, customerId: '', amountPaid: '', salesAmount: '', notes: '' }
}

export default function CustomerPaymentsFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankEntry()])
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const custs = await db.customers.where('orgId').equals(orgId).toArray()
      if (custs.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      setCustomers(custs)

      if (editId) {
        const entry = await customerPaymentsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            customerId: entry.customerId || '',
            amountPaid: String(entry.amountPaid ?? ''),
            salesAmount: String(entry.salesAmount ?? ''),
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.customerPayments.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            customerId: e.customerId || '',
            amountPaid: String(e.amountPaid ?? ''),
            salesAmount: String(e.salesAmount ?? ''),
            notes: e.notes || '',
          })))
        }
      }

      if (!cancelled) {
        const allPayments = await db.customerPayments.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allPayments.map(e => e.entryDate).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const isEditing = !!(editId || editDate)

  const handleSubmit = async (e) => {
    e.preventDefault()
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].customerId) { setError(`Entry ${i + 1}: Customer is required`); return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await customerPaymentsRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          customerId: entry.customerId,
          amountPaid: Number(entry.amountPaid) || 0,
          salesAmount: Number(entry.salesAmount) || 0,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await customerPaymentsRepo.getById(entry.id)
          await customerPaymentsRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await customerPaymentsRepo.create(record)
        }
      }

      router.push(`/dashboard/entries/customer-payments/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Accounts service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  const currentDateIdx = editDate ? allDates.indexOf(editDate) : -1
  const prevDate = currentDateIdx > 0 ? allDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx < allDates.length - 1 ? allDates[currentDateIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Entries' : 'New Account Payment'}</h1>
        <div className="flex items-center gap-2">
          {isEditing && editDate && (
            <>
              <button type="button" onClick={() => router.push(`/dashboard/entries/customer-payments?${qs}&edit_date=${prevDate}`)} disabled={!prevDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => router.push(`/dashboard/entries/customer-payments?${qs}&edit_date=${nextDate}`)} disabled={!nextDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
          <Link href={`/dashboard/entries/customer-payments/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
            <List className="w-4 h-4" /> View Entries
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Shared date */}
        <div className="border border-gray-300 mb-4">
          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Transaction Date</label>
          <DateInput value={formDate} onChange={setFormDate} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
        </div>

        {/* Entry cards */}
        {entries.map((entry, idx) => (
          <div key={entry._key} className="border border-gray-300 divide-y divide-gray-300 mb-3">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
              <span className="text-xs font-medium text-gray-500">Entry {idx + 1}</span>
              {entries.length > 1 && (
                <button type="button" onClick={() => removeEntry(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Account</label>
              <SearchableSelect
                value={entry.customerId}
                onChange={(val) => updateEntry(idx, 'customerId', val)}
                options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.phone || '' }))}
                placeholder="Select account"
              />
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Amount Paid</label>
                <input type="number" value={entry.amountPaid} onChange={(e) => updateEntry(idx, 'amountPaid', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Sales Amount</label>
                <input type="number" value={entry.salesAmount} onChange={(e) => updateEntry(idx, 'salesAmount', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
              <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
            </div>
          </div>
        ))}

        <button type="button" onClick={addEntry} className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700 mb-4">
          <Plus className="w-4 h-4" /> Add Entry
        </button>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/entries/customer-payments/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>
    </div>
  )
}
