'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, AlertTriangle, Lock, Plus, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { lubeSalesRepo } from '@/lib/repositories/lubeSales'
import { lubeStockRepo } from '@/lib/repositories/lubeStock'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_DATE, ENTRY_SELECT, ENTRY_LINE, ENTRY_DIVIDE, BTN_PRIMARY, BTN_FRAMED } from '@/components/ui'

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
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'lube-management')
  const subBlocked = !subLoading && !isSubscribed
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <AlertTriangle className="w-8 h-8 text-content-faint mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-content mb-1">Station Not Configured</h2>
        <p className="text-sm text-content-muted mb-4">Set up your station in Settings before creating entries.</p>
        <Link href={`/dashboard/stations/${orgId}/settings`} className={`inline-block px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>Go to Settings</Link>
      </div>
    </div>
  )

  const isEditing = !!(editId || editDate)

  const currentDateIdx = editDate ? allDates.indexOf(editDate) : -1
  const prevDate = currentDateIdx > 0 ? allDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx < allDates.length - 1 ? allDates[currentDateIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-end mb-6 gap-2">
          {isEditing && editDate && (
            <>
              <button type="button" onClick={() => router.push(`/dashboard/entries/lube?${qs}&edit_date=${prevDate}&type=${tab}`)} disabled={!prevDate} className={`flex items-center justify-center text-sm px-2 py-2 disabled:opacity-30 disabled:cursor-not-allowed ${BTN_FRAMED}`}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => router.push(`/dashboard/entries/lube?${qs}&edit_date=${nextDate}&type=${tab}`)} disabled={!nextDate} className={`flex items-center justify-center text-sm px-2 py-2 disabled:opacity-30 disabled:cursor-not-allowed ${BTN_FRAMED}`}><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
          <Link href={`/dashboard/entries/lube/list?${qs}`} className={`flex items-center gap-1 text-sm px-3 py-2 font-medium ${BTN_FRAMED}`}>
            <List className="w-4 h-4" /> View Entries
          </Link>
      </div>

      {!editId && !editDate && (
        <div className="flex border-b border-line mb-6">
          <button onClick={() => setTab('sales')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'sales' ? 'border-blue-600 text-primary-600' : 'border-transparent text-content-muted hover:text-content-strong'}`}>
            Lube Sales
          </button>
          <button onClick={() => setTab('stock')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-blue-600 text-primary-600' : 'border-transparent text-content-muted hover:text-content-strong'}`}>
            Lube Stock
          </button>
        </div>
      )}

      {subBlocked && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-4 py-3 mb-4 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Subscribe to add entries</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">You can view existing data, but creating new entries requires an active subscription.</p>
          </div>
          <Link href="/dashboard/subscribe" className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium ${BTN_PRIMARY}`}>Subscribe</Link>
        </div>
      )}

      {tab === 'sales'
        ? <LubeSalesForm products={products} qs={qs} orgId={orgId} editId={editId} editDate={editDate} subBlocked={subBlocked} />
        : <LubeStockForm products={products} qs={qs} orgId={orgId} editId={editId} editDate={editDate} subBlocked={subBlocked} />
      }
    </div>
  )
}

function LubeSalesForm({ products, qs, orgId, editId, editDate, subBlocked }) {
  const router = useRouter()
  const { promptPush } = useSavePush()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankSalesEntry()])
  const [originalIds, setOriginalIds] = useState([])

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  useEffect(() => {
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
        const dateEntries = all.filter(e => e.entryDate === editDate).sort(byCreatedAt)
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
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.lubeSales.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today).sort(byCreatedAt)
        if (dateEntries.length > 0) {
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

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.lubeSales.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate).sort(byCreatedAt)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => ({
        _key: e.id, id: e.id,
        productId: e.productId || '',
        unitSold: String(e.unitSold ?? ''),
        unitReceived: String(e.unitReceived ?? ''),
        price: String(e.price ?? ''),
        notes: e.notes || '',
      })))
    } else {
      setOriginalIds([])
      setEntries([blankSalesEntry()])
    }
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankSalesEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError(`Entry ${i + 1}: Product is required`); submittingRef.current = false; return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const nowMs = Date.now()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lubeSalesRepo.remove(id, orgId)
        }
      }

      for (const [i, entry] of entries.entries()) {
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
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lubeSalesRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/lube/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
      {/* Shared date */}
      <div className={`border-card ${ENTRY_LINE} mb-4`}>
        <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Entry Date</label>
        <DateInput value={formDate} onChange={handleDateChange} className={ENTRY_DATE} />
      </div>

      {/* Entry cards */}
      {entries.map((entry, idx) => (
        <div key={entry._key} className={`border-card ${ENTRY_LINE} divide-y-card ${ENTRY_DIVIDE} mb-3`}>
          <div className="flex items-center justify-between px-3 py-1.5 bg-subtle">
            <span className="text-xs font-medium text-content-muted">Entry {idx + 1}</span>
            {entries.length > 1 && (
              <button type="button" onClick={() => removeEntry(idx)} className="text-red-400 hover:text-red-600 dark:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Product</label>
            <SearchableSelect
              value={entry.productId}
              onChange={(val) => updateEntry(idx, 'productId', val)}
              options={products.map((p) => ({ value: p.id, label: p.product_name }))}
              placeholder="Select product"
              className={ENTRY_SELECT}
            />
          </div>
          <div className={`grid grid-cols-3 divide-x-card ${ENTRY_DIVIDE}`}>
            <div>
              <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Unit Sold</label>
              <input type="number" value={entry.unitSold} onChange={(e) => updateEntry(idx, 'unitSold', e.target.value)} step="0.01" min="0" className={ENTRY_INPUT} />
            </div>
            <div>
              <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Unit Received</label>
              <input type="number" value={entry.unitReceived} onChange={(e) => updateEntry(idx, 'unitReceived', e.target.value)} step="0.01" min="0" className={ENTRY_INPUT} />
            </div>
            <div>
              <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Price</label>
              <input type="number" value={entry.price} onChange={(e) => updateEntry(idx, 'price', e.target.value)} step="0.01" min="0" className={ENTRY_INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Notes</label>
            <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
          </div>
        </div>
      ))}

      <button type="button" onClick={addEntry} className="flex items-center gap-1 text-sm text-primary-600 font-medium hover:text-primary-700 mb-4">
        <Plus className="w-4 h-4" /> Add Entry
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <Link href={`/dashboard/entries/lube/list?${qs}`} className={`ml-auto px-4 py-2 text-sm ${BTN_FRAMED}`}>Cancel</Link>
        <button type="submit" disabled={saving || saved || subBlocked} className={`flex items-center gap-2 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 ${saved ? 'bg-green-600' : 'bg-primary-500 hover:bg-primary-600'}`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved && <Check className="w-4 h-4" />}
          {saved ? 'Saved!' : isEditing ? 'Update' : 'Save All'}
        </button>
      </div>
    </form>
  )
}

function LubeStockForm({ products, qs, orgId, editId, editDate, subBlocked }) {
  const router = useRouter()
  const { promptPush } = useSavePush()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankStockEntry()])
  const [originalIds, setOriginalIds] = useState([])

  useEffect(() => {
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
        const dateEntries = all.filter(e => e.entryDate === editDate).sort(byCreatedAt)
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
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.lubeStock.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today).sort(byCreatedAt)
        if (dateEntries.length > 0) {
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

  // When date changes in create mode, auto-load existing entries for that date
  const handleStockDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.lubeStock.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate).sort(byCreatedAt)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => ({
        _key: e.id, id: e.id,
        productId: e.productId || '',
        stock: String(e.stock ?? ''),
        notes: e.notes || '',
      })))
    } else {
      setOriginalIds([])
      setEntries([blankStockEntry()])
    }
  }

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankStockEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError(`Entry ${i + 1}: Product is required`); submittingRef.current = false; return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const nowMs = Date.now()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lubeStockRepo.remove(id, orgId)
        }
      }

      for (const [i, entry] of entries.entries()) {
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
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lubeStockRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/lube/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
      {/* Shared date */}
      <div className={`border-card ${ENTRY_LINE} mb-4`}>
        <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Entry Date</label>
        <DateInput value={formDate} onChange={handleStockDateChange} className={ENTRY_DATE} />
      </div>

      {/* Entry cards */}
      {entries.map((entry, idx) => (
        <div key={entry._key} className={`border-card ${ENTRY_LINE} divide-y-card ${ENTRY_DIVIDE} mb-3`}>
          <div className="flex items-center justify-between px-3 py-1.5 bg-subtle">
            <span className="text-xs font-medium text-content-muted">Entry {idx + 1}</span>
            {entries.length > 1 && (
              <button type="button" onClick={() => removeEntry(idx)} className="text-red-400 hover:text-red-600 dark:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Product</label>
            <SearchableSelect
              value={entry.productId}
              onChange={(val) => updateEntry(idx, 'productId', val)}
              options={products.map((p) => ({ value: p.id, label: p.product_name }))}
              placeholder="Select product"
              className={ENTRY_SELECT}
            />
          </div>
          <div>
            <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Stock</label>
            <input type="number" value={entry.stock} onChange={(e) => updateEntry(idx, 'stock', e.target.value)} step="0.01" min="0" className={ENTRY_INPUT} />
          </div>
          <div>
            <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Notes</label>
            <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
          </div>
        </div>
      ))}

      <button type="button" onClick={addEntry} className="flex items-center gap-1 text-sm text-primary-600 font-medium hover:text-primary-700 mb-4">
        <Plus className="w-4 h-4" /> Add Entry
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <Link href={`/dashboard/entries/lube/list?${qs}`} className={`ml-auto px-4 py-2 text-sm ${BTN_FRAMED}`}>Cancel</Link>
        <button type="submit" disabled={saving || saved || subBlocked} className={`flex items-center gap-2 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 ${saved ? 'bg-green-600' : 'bg-primary-500 hover:bg-primary-600'}`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved && <Check className="w-4 h-4" />}
          {saved ? 'Saved!' : isEditing ? 'Update' : 'Save All'}
        </button>
      </div>
    </form>
  )
}
