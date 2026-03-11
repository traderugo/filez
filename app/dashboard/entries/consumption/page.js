'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { consumptionRepo } from '@/lib/repositories/consumption'
import DateInput from '@/components/DateInput'

const FUEL_TYPES = ['PMS', 'AGO', 'DPK']

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, customerId: '', quantity: '', fuelType: '', price: '', isPourBack: false, notes: '' }
}

export default function ConsumptionFormPage() {
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
  // Track original IDs when editing so we can detect deletions
  const [originalIds, setOriginalIds] = useState([])

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
        // Single entry edit (backwards compat)
        const entry = await consumptionRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id,
            id: entry.id,
            customerId: entry.customerId || '',
            quantity: String(entry.quantity ?? ''),
            fuelType: entry.fuelType || '',
            price: String(entry.price ?? ''),
            isPourBack: !!entry.isPourBack,
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        // Load all entries for this date
        const all = await db.consumption.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id,
            id: e.id,
            customerId: e.customerId || '',
            quantity: String(e.quantity ?? ''),
            fuelType: e.fuelType || '',
            price: String(e.price ?? ''),
            isPourBack: !!e.isPourBack,
            notes: e.notes || '',
          })))
        }
      }

      if (!cancelled) setLoading(false)
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
    // Validate
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].customerId) { setError(`Entry ${i + 1}: Account is required`); return }
      if (!entries[i].fuelType) { setError(`Entry ${i + 1}: Fuel type is required`); return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      // Delete removed entries
      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await consumptionRepo.remove(id, orgId)
        }
      }

      // Create or update each entry
      for (const entry of entries) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          customerId: entry.customerId,
          quantity: Number(entry.quantity) || 0,
          fuelType: entry.fuelType,
          price: Number(entry.price) || 0,
          isPourBack: entry.isPourBack,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await consumptionRepo.getById(entry.id)
          await consumptionRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await consumptionRepo.create(record)
        }
      }

      router.push(`/dashboard/entries/consumption/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Fuel Operations service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Entries' : 'New Consumption Entry'}</h1>
        <Link href={`/dashboard/entries/consumption/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Shared date */}
        <div className="border border-gray-300 mb-4">
          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Date</label>
          <DateInput value={formDate} onChange={setFormDate} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
        </div>

        {/* Entry cards */}
        {entries.map((entry, idx) => (
          <div key={entry._key} className="border border-gray-300 divide-y divide-gray-300 mb-3">
            {/* Entry header with delete */}
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
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Account</label>
                <select value={entry.customerId} onChange={(e) => updateEntry(idx, 'customerId', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50">
                  <option value="">Select account</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Fuel Type</label>
                <select value={entry.fuelType} onChange={(e) => updateEntry(idx, 'fuelType', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50">
                  <option value="">Select fuel type</option>
                  {FUEL_TYPES.map((ft) => (
                    <option key={ft} value={ft}>{ft}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Quantity (litres)</label>
                <input type="number" value={entry.quantity} onChange={(e) => updateEntry(idx, 'quantity', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Price (per litre)</label>
                <input type="number" value={entry.price} onChange={(e) => updateEntry(idx, 'price', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div className="flex items-center gap-3 px-3 py-3">
              <button
                type="button"
                onClick={() => updateEntry(idx, 'isPourBack', !entry.isPourBack)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${entry.isPourBack ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${entry.isPourBack ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-700">{entry.isPourBack ? 'Pour Back' : 'Consumption'}</span>
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
              <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
            </div>
          </div>
        ))}

        {/* Add entry button */}
        <button type="button" onClick={addEntry} className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700 mb-4">
          <Plus className="w-4 h-4" /> Add Entry
        </button>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/entries/consumption/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>
    </div>
  )
}
