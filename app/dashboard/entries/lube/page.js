'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { lubeSalesRepo } from '@/lib/repositories/lubeSales'
import { lubeStockRepo } from '@/lib/repositories/lubeStock'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'

function blankSalesEntry() {
  return { _key: crypto.randomUUID(), id: null, productId: '', unitSold: '', unitReceived: '', price: '', notes: '' }
}

function blankStockEntry() {
  return { _key: crypto.randomUUID(), id: null, productId: '', stock: '', notes: '' }
}

export default function LubeFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const editType = searchParams.get('type') || 'sales'
  const qs = `org_id=${orgId}`

  const [tab, setTab] = useState(editType)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [allDates, setAllDates] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const load = async () => {
      const prods = await db.lubeProducts.where('orgId').equals(orgId).toArray()
      if (prods.length === 0) setLocked(true)
      setProducts(prods)

      const table = tab === 'stock' ? db.lubeStock : db.lubeSales
      const allEntries = await table.where('orgId').equals(orgId).toArray()
      const uniqueDates = [...new Set(allEntries.map(e => e.entryDate).filter(Boolean))].sort()
      setAllDates(uniqueDates)

      setLoading(false)
    }
    load()
  }, [orgId, tab])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Lube Management service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  const isEditing = !!(editId || editDate)

  const currentDateIdx = editDate ? allDates.indexOf(editDate) : -1
  const prevDate = currentDateIdx > 0 ? allDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx < allDates.length - 1 ? allDates[currentDateIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        {isEditing && editDate && (
          <>
            <button type="button" onClick={() => router.push(`/dashboard/entries/lube?${qs}&edit_date=${prevDate}&type=${tab}`)} disabled={!prevDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => router.push(`/dashboard/entries/lube?${qs}&edit_date=${nextDate}&type=${tab}`)} disabled={!nextDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
          </>
        )}
        <Link href={`/dashboard/entries/lube/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50 ml-auto">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      {!editId && !editDate && (
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setTab('sales')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Lube Sales
          </button>
          <button onClick={() => setTab('stock')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Lube Stock
          </button>
        </div>
      )}

      {tab === 'sales'
        ? <LubeSalesForm products={products} qs={qs} orgId={orgId} editId={editId} editDate={editDate} />
        : <LubeStockForm products={products} qs={qs} orgId={orgId} editId={editId} editDate={editDate} />
      }
    </div>
  )
}

function LubeSalesForm({ products, qs, orgId, editId, editDate }) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankSalesEntry()])
  const [originalIds, setOriginalIds] = useState([])

  const isEditing = !!(editId || editDate)

  useEffect(() => {
    if (!editId && !editDate) return
    const load = async () => {
      if (editId) {
        const entry = await lubeSalesRepo.getById(editId)
        if (entry) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            productId: entry.productId || '',
            unitSold: String(entry.unitSold ?? ''),
            unitReceived: String(entry.unitReceived ?? ''),
            price: String(entry.price ?? ''),
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.lubeSales.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            productId: e.productId || '',
            unitSold: String(e.unitSold ?? ''),
            unitReceived: String(e.unitReceived ?? ''),
            price: String(e.price ?? ''),
            notes: e.notes || '',
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [editId, editDate, orgId])

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankSalesEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError(`Entry ${i + 1}: Product is required`); return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lubeSalesRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          productId: entry.productId,
          unitSold: Number(entry.unitSold) || 0,
          unitReceived: Number(entry.unitReceived) || 0,
          price: Number(entry.price) || 0,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await lubeSalesRepo.getById(entry.id)
          await lubeSalesRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await lubeSalesRepo.create(record)
        }
      }

      router.push(`/dashboard/entries/lube/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
      {/* Shared date */}
      <div className="border border-gray-300 mb-4">
        <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
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
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Product</label>
            <SearchableSelect
              value={entry.productId}
              onChange={(val) => updateEntry(idx, 'productId', val)}
              options={products.map((p) => ({ value: p.id, label: p.product_name }))}
              placeholder="Select product"
            />
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Unit Sold</label>
              <input type="number" value={entry.unitSold} onChange={(e) => updateEntry(idx, 'unitSold', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Unit Received</label>
              <input type="number" value={entry.unitReceived} onChange={(e) => updateEntry(idx, 'unitReceived', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Price</label>
              <input type="number" value={entry.price} onChange={(e) => updateEntry(idx, 'price', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
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
        <Link href={`/dashboard/entries/lube/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? 'Update' : 'Save All'}
        </button>
      </div>
    </form>
  )
}

function LubeStockForm({ products, qs, orgId, editId, editDate }) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankStockEntry()])
  const [originalIds, setOriginalIds] = useState([])

  const isEditing = !!(editId || editDate)

  useEffect(() => {
    if (!editId && !editDate) return
    const load = async () => {
      if (editId) {
        const entry = await lubeStockRepo.getById(editId)
        if (entry) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            productId: entry.productId || '',
            stock: String(entry.stock ?? ''),
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.lubeStock.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            productId: e.productId || '',
            stock: String(e.stock ?? ''),
            notes: e.notes || '',
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [editId, editDate, orgId])

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankStockEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError(`Entry ${i + 1}: Product is required`); return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lubeStockRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          productId: entry.productId,
          stock: Number(entry.stock) || 0,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await lubeStockRepo.getById(entry.id)
          await lubeStockRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await lubeStockRepo.create(record)
        }
      }

      router.push(`/dashboard/entries/lube/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
      {/* Shared date */}
      <div className="border border-gray-300 mb-4">
        <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
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
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Product</label>
            <SearchableSelect
              value={entry.productId}
              onChange={(val) => updateEntry(idx, 'productId', val)}
              options={products.map((p) => ({ value: p.id, label: p.product_name }))}
              placeholder="Select product"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Stock</label>
            <input type="number" value={entry.stock} onChange={(e) => updateEntry(idx, 'stock', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
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
        <Link href={`/dashboard/entries/lube/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? 'Update' : 'Save All'}
        </button>
      </div>
    </form>
  )
}
