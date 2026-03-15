'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { productReceiptsRepo } from '@/lib/repositories/productReceipts'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'

function blankEntry(tanks) {
  return {
    _key: crypto.randomUUID(),
    id: null,
    loadedDate: '', driverName: '', waybillNumber: '', ticketNumber: '', truckNumber: '',
    chartUllage: '', chartLiquidHeight: '', depotUllage: '', depotLiquidHeight: '',
    stationUllage: '', stationLiquidHeight: '',
    firstCompartment: '', secondCompartment: '', thirdCompartment: '',
    actualVolume: '', depotName: '', tankId: '', notes: '',
  }
}

function entryFromRecord(entry) {
  return {
    _key: entry.id,
    id: entry.id,
    loadedDate: entry.loadedDate || '',
    driverName: entry.driverName || '',
    waybillNumber: entry.waybillNumber || '',
    ticketNumber: entry.ticketNumber || '',
    truckNumber: entry.truckNumber || '',
    chartUllage: entry.chartUllage ?? '',
    chartLiquidHeight: entry.chartLiquidHeight ?? '',
    depotUllage: entry.depotUllage ?? '',
    depotLiquidHeight: entry.depotLiquidHeight ?? '',
    stationUllage: entry.stationUllage ?? '',
    stationLiquidHeight: entry.stationLiquidHeight ?? '',
    firstCompartment: entry.firstCompartment ?? '',
    secondCompartment: entry.secondCompartment ?? '',
    thirdCompartment: entry.thirdCompartment ?? '',
    actualVolume: entry.actualVolume ?? '',
    depotName: entry.depotName || '',
    tankId: entry.tankId || '',
    notes: entry.notes || '',
  }
}

export default function ProductReceiptFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [tanks, setTanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [originalIds, setOriginalIds] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()
      if (tnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setTanks(tnk)

      if (editId) {
        const entry = await productReceiptsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([entryFromRecord(entry)])
        }
      } else if (editDate) {
        const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => entryFromRecord(e)))
        }
      }

      if (!cancelled) {
        setEntries(prev => prev.length > 0 ? prev : [blankEntry(tnk)])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  const isEditing = !!(editId || editDate)

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => {
    setEntries(prev => [...prev, blankEntry(tanks)])
    setActiveTab(entries.length)
  }

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
    setActiveTab(Math.min(activeTab, entries.length - 2))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await productReceiptsRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          loadedDate: entry.loadedDate || null,
          driverName: entry.driverName,
          waybillNumber: entry.waybillNumber,
          ticketNumber: entry.ticketNumber,
          truckNumber: entry.truckNumber,
          chartUllage: Number(entry.chartUllage) || 0,
          chartLiquidHeight: Number(entry.chartLiquidHeight) || 0,
          depotUllage: Number(entry.depotUllage) || 0,
          depotLiquidHeight: Number(entry.depotLiquidHeight) || 0,
          stationUllage: Number(entry.stationUllage) || 0,
          stationLiquidHeight: Number(entry.stationLiquidHeight) || 0,
          firstCompartment: Number(entry.firstCompartment) || 0,
          secondCompartment: Number(entry.secondCompartment) || 0,
          thirdCompartment: Number(entry.thirdCompartment) || 0,
          actualVolume: Number(entry.actualVolume) || 0,
          depotName: entry.depotName,
          tankId: entry.tankId || null,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await productReceiptsRepo.getById(entry.id)
          await productReceiptsRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await productReceiptsRepo.create(record)
        }
      }

      router.push(`/dashboard/entries/product-receipt/list?${qs}`)
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
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Daily Sales Operations service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  const current = entries[activeTab]

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Entries' : 'New Product Receipt'}</h1>
        <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
        {/* Shared date */}
        <div className="border border-gray-300 mb-4">
          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
          <DateInput value={formDate} onChange={setFormDate} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
        </div>

        {/* Entry tabs */}
        <div className="flex items-center border-b border-gray-300 mb-0">
          {entries.map((entry, idx) => (
            <button
              key={entry._key}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === idx ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Entry {idx + 1}
            </button>
          ))}
          <button type="button" onClick={addEntry} className="px-3 py-2 text-blue-600 hover:text-blue-700">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Active entry form */}
        {current && (
          <div className="border border-gray-300 border-t-0 divide-y divide-gray-300">
            {entries.length > 1 && (
              <div className="flex justify-end px-3 py-1.5 bg-gray-50">
                <button type="button" onClick={() => removeEntry(activeTab)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                  <Trash2 className="w-3.5 h-3.5" /> Remove Entry {activeTab + 1}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Loaded Date</label>
                <DateInput value={current.loadedDate} onChange={(v) => updateEntry(activeTab, 'loadedDate', v)} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Depot Name</label>
                <input type="text" value={current.depotName} onChange={(e) => updateEntry(activeTab, 'depotName', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Driver Name</label>
                <input type="text" value={current.driverName} onChange={(e) => updateEntry(activeTab, 'driverName', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Waybill No.</label>
                <input type="text" value={current.waybillNumber} onChange={(e) => updateEntry(activeTab, 'waybillNumber', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Ticket No.</label>
                <input type="text" value={current.ticketNumber} onChange={(e) => updateEntry(activeTab, 'ticketNumber', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Truck Number</label>
                <input type="text" value={current.truckNumber} onChange={(e) => updateEntry(activeTab, 'truckNumber', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Receiving Tank</label>
                <SearchableSelect
                  value={current.tankId}
                  onChange={(val) => updateEntry(activeTab, 'tankId', val)}
                  options={tanks.map((t) => ({ value: t.id, label: `Tank ${t.tank_number}`, sub: t.fuel_type }))}
                  placeholder="Select tank"
                />
              </div>
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Chart / Depot / Station</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Chart Ullage</label>
                <input type="number" value={current.chartUllage} onChange={(e) => updateEntry(activeTab, 'chartUllage', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Chart Liq. Height</label>
                <input type="number" value={current.chartLiquidHeight} onChange={(e) => updateEntry(activeTab, 'chartLiquidHeight', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Depot Ullage</label>
                <input type="number" value={current.depotUllage} onChange={(e) => updateEntry(activeTab, 'depotUllage', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Depot Liq. Height</label>
                <input type="number" value={current.depotLiquidHeight} onChange={(e) => updateEntry(activeTab, 'depotLiquidHeight', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Station Ullage</label>
                <input type="number" value={current.stationUllage} onChange={(e) => updateEntry(activeTab, 'stationUllage', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Station Liq. Height</label>
                <input type="number" value={current.stationLiquidHeight} onChange={(e) => updateEntry(activeTab, 'stationLiquidHeight', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Compartments</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">1st Compartment</label>
                <input type="number" value={current.firstCompartment} onChange={(e) => updateEntry(activeTab, 'firstCompartment', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">2nd Compartment</label>
                <input type="number" value={current.secondCompartment} onChange={(e) => updateEntry(activeTab, 'secondCompartment', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">3rd Compartment</label>
                <input type="number" value={current.thirdCompartment} onChange={(e) => updateEntry(activeTab, 'thirdCompartment', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Actual Volume</label>
              <input type="number" value={current.actualVolume} onChange={(e) => updateEntry(activeTab, 'actualVolume', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
              <textarea value={current.notes} onChange={(e) => updateEntry(activeTab, 'notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>
    </div>
  )
}
