'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, AlertTriangle, Lock, Plus, ChevronLeft, ChevronRight, Check, ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { lodgementsRepo } from '@/lib/repositories/lodgements'
import DateInput from '@/components/DateInput'
import { useSavePush } from '@/components/SavePushProvider'

/** What distinguishes two accounts at the same bank: the POS terminal, or the type. */
function bankSub(b) {
  if (!b) return ''
  if (b.lodgement_type === 'pos') return b.terminal_id || 'POS'
  return b.lodgement_type || ''
}

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, amount: '', bankId: '', lodgementType: 'deposit', salesDate: new Date().toISOString().split('T')[0], notes: '' }
}

export default function LodgementsFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { promptPush } = useSavePush()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'fuel-operations')

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [banks, setBanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankEntry()])
  // Which entry's account picker is open, as an index. Same bottom sheet as the daily-sales
  // consumption picker: chosen one-handed on a phone, so the options belong in thumb reach.
  const [bankSheet, setBankSheet] = useState(null)
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
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.lodgements.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today)
        if (dateEntries.length > 0 && !cancelled) {
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

  // Map bank lodgement_type to form lodgementType
  const bankTypeToFormType = (bankType) => {
    if (bankType === 'pos') return 'pos'
    if (bankType === 'transfer') return 'transfer'
    return 'deposit'
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      const updated = { ...e, [field]: value }
      // Auto-set lodgementType when bank changes
      if (field === 'bankId') {
        const bank = banks.find(b => b.id === value)
        if (bank) updated.lodgementType = bankTypeToFormType(bank.lodgement_type)
      }
      return updated
    }))
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
          salesDate: entry.salesDate || formDate,
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

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/lodgements/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Station Not Configured</h2>
        <p className="text-sm text-gray-500 mb-4">Set up your station in Settings before creating entries.</p>
        <Link href={`/dashboard/stations/${orgId}/settings`} className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Go to Settings</Link>
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
                {(() => {
                  const chosen = banks.find((b) => b.id === entry.bankId)
                  return (
                    <button
                      type="button"
                      onClick={() => setBankSheet(idx)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-base bg-transparent hover:bg-blue-50"
                    >
                      <span className={`flex-1 truncate ${chosen ? 'text-gray-900' : 'text-gray-400'}`}>
                        {chosen ? chosen.bank_name : 'Select account'}
                        {chosen && <span className="text-gray-400"> · {bankSub(chosen)}</span>}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  )
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Sales Date</label>
                <DateInput value={entry.salesDate} onChange={(v) => updateEntry(idx, 'salesDate', v)} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Type</label>
                <div className="px-3 py-2.5 text-base text-gray-500 capitalize">{entry.lodgementType || '—'}</div>
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

        {!subLoading && !isSubscribed && (
          <div className="bg-amber-50 border border-amber-200 px-4 py-3 mt-3 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-800 font-medium">Subscribe to add entries</p>
              <p className="text-xs text-amber-600 mt-0.5">You can view existing data, but creating new entries requires an active subscription.</p>
            </div>
            <Link href="/dashboard/subscribe" className="flex-shrink-0 bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700">Subscribe</Link>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/entries/lodgements/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving || saved || (!subLoading && !isSubscribed)} className={`flex items-center gap-2 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && <Check className="w-4 h-4" />}
            {saved ? 'Saved!' : isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>

      {/* Account / terminal sheet — the same picker as the daily-sales consumption account.
          A station has a handful of accounts and several POS terminals at the same bank, so
          the terminal is shown beside each name; that is usually the only thing telling two
          rows apart. */}
      {bankSheet !== null && (() => {
        const entry = entries[bankSheet]
        if (!entry) return null
        const ordered = [...banks].sort(
          (a, b) => (a.bank_name || '').localeCompare(b.bank_name || '') ||
            bankSub(a).localeCompare(bankSub(b))
        )
        const pick = (val) => { updateEntry(bankSheet, 'bankId', val); setBankSheet(null) }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setBankSheet(null)}>
            <div className="bg-white w-full sm:max-w-md max-h-[55vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Bank Account</h3>
                  <p className="text-xs text-gray-500">Entry {bankSheet + 1}</p>
                </div>
                <button type="button" onClick={() => setBankSheet(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-gray-100">
                {ordered.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No bank accounts set up for this station yet.</p>
                ) : ordered.map((b) => {
                  const selected = b.id === entry.bankId
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pick(b.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${selected ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-800 hover:bg-gray-50'}`}
                    >
                      <span className="flex-1 truncate">
                        {b.bank_name}
                        <span className={selected ? 'text-blue-600' : 'text-gray-400'}> · {bankSub(b)}</span>
                      </span>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {entry.bankId && (
                <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0"
                     style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
                  <button type="button" onClick={() => pick('')} className="text-sm text-red-600 hover:text-red-700">
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
