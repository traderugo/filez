'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { lodgementsRepo } from '@/lib/repositories/lodgements'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, amount: '', bankId: '', lodgementType: 'deposit', salesDate: '', notes: '' }
}

export default function LodgementsFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [banks, setBanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankEntry()])
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])
  const submittingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const bnk = await db.banks.where('orgId').equals(orgId).toArray()
      if (bnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      setBanks(bnk)

      if (editId) {
        const entry = await lodgementsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            amount: String(entry.amount ?? ''),
            bankId: entry.bankId || '',
            lodgementType: entry.lodgementType || 'deposit',
            salesDate: entry.salesDate || '',
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.lodgements.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            amount: String(e.amount ?? ''),
            bankId: e.bankId || '',
            lodgementType: e.lodgementType || 'deposit',
            salesDate: e.salesDate || '',
            notes: e.notes || '',
          })))
        }
      }

      if (!cancelled) {
        const allLodgements = await db.lodgements.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allLodgements.map(e => e.entryDate).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.lodgements.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => ({
        _key: e.id, id: e.id,
        amount: String(e.amount ?? ''),
        bankId: e.bankId || '',
        lodgementType: e.lodgementType || 'deposit',
        salesDate: e.salesDate || '',
        notes: e.notes || '',
      })))
    } else {
      setOriginalIds([])
      setEntries([blankEntry()])
    }
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].bankId) { setError(`Entry ${i + 1}: Bank account is required`); submittingRef.current = false; return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lodgementsRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          amount: Number(entry.amount) || 0,
          bankId: entry.bankId,
          lodgementType: entry.lodgementType,
          salesDate: entry.salesDate || null,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await lodgementsRepo.getById(entry.id)
          await lodgementsRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await lodgementsRepo.create(record)
        }
      }

      router.push(`/dashboard/entries/lodgements/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
    submittingRef.current = false
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Daily Sales Operations service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  const currentDateIdx = editDate ? allDates.indexOf(editDate) : -1
  const prevDate = currentDateIdx > 0 ? allDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx < allDates.length - 1 ? allDates[currentDateIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-end mb-6 gap-2">
          {isEditing && editDate && (
            <>
              <button type="button" onClick={() => router.push(`/dashboard/entries/lodgements?${qs}&edit_date=${prevDate}`)} disabled={!prevDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => router.push(`/dashboard/entries/lodgements?${qs}&edit_date=${nextDate}`)} disabled={!nextDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
          <Link href={`/dashboard/entries/lodgements/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
            <List className="w-4 h-4" /> View Entries
          </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Shared date */}
        <div className="border border-gray-300 mb-4">
          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
          <DateInput value={formDate} onChange={handleDateChange} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
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
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Amount</label>
                <input type="number" value={entry.amount} onChange={(e) => updateEntry(idx, 'amount', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Bank Account</label>
                <SearchableSelect
                  value={entry.bankId}
                  onChange={(val) => updateEntry(idx, 'bankId', val)}
                  options={banks.map((b) => ({ value: b.id, label: b.bank_name, sub: b.lodgement_type }))}
                  placeholder="Select account"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Type</label>
                <select value={entry.lodgementType} onChange={(e) => updateEntry(idx, 'lodgementType', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50">
                  <option value="deposit">Deposit</option>
                  <option value="lube-deposit">Lube Deposit</option>
                  <option value="pos">POS</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Sales Date</label>
                <DateInput value={entry.salesDate} onChange={(v) => updateEntry(idx, 'salesDate', v)} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
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
          <Link href={`/dashboard/entries/lodgements/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>
    </div>
  )
}
