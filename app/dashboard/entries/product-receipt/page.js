'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { productReceiptsRepo } from '@/lib/repositories/productReceipts'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'

function blankEntry(tanks) {
  return {
    _key: crypto.randomUUID(),
    ids: [],
    loadedDate: '', driverName: '', waybillNumber: '', ticketNumber: '', truckNumber: '',
    chartUllage1: '', chartUllage2: '', chartUllage3: '',
    chartLiquidHeight1: '', chartLiquidHeight2: '', chartLiquidHeight3: '',
    depotUllage1: '', depotUllage2: '', depotUllage3: '',
    depotLiquidHeight1: '', depotLiquidHeight2: '', depotLiquidHeight3: '',
    stationUllage1: '', stationUllage2: '', stationUllage3: '',
    stationLiquidHeight1: '', stationLiquidHeight2: '', stationLiquidHeight3: '',
    firstCompartment: '', secondCompartment: '', thirdCompartment: '',
    tankVolumes: Object.fromEntries(tanks.map(t => [t.id, ''])),
    depotName: '', arrivalTime: '', exitTime: '', notes: '',
  }
}

/**
 * Group raw DB records (one per tank) into form entries (one per delivery).
 * Groups by shared delivery fields; old single-tank entries become their own group.
 */
function groupRecordsIntoEntries(records, tanks) {
  const groups = {}
  for (const r of records) {
    // Group key: shared delivery info (waybill + truck + driver + depot + loadedDate)
    const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
    const key = parts.some(Boolean) ? parts.join('|') : r.id
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }
  return Object.values(groups).map(group => {
    const first = group[0]
    const tankVolumes = Object.fromEntries(tanks.map(t => [t.id, '']))
    const ids = []
    for (const r of group) {
      ids.push(r.id)
      if (r.tankId && Number(r.actualVolume || 0) > 0) {
        tankVolumes[r.tankId] = String(r.actualVolume)
      }
    }
    return {
      _key: first.id,
      ids,
      loadedDate: first.loadedDate || '',
      driverName: first.driverName || '',
      waybillNumber: first.waybillNumber || '',
      ticketNumber: first.ticketNumber || '',
      truckNumber: first.truckNumber || '',
      chartUllage1: first.chartUllage1 ?? first.chartUllage ?? '',
      chartUllage2: first.chartUllage2 ?? '',
      chartUllage3: first.chartUllage3 ?? '',
      chartLiquidHeight1: first.chartLiquidHeight1 ?? first.chartLiquidHeight ?? '',
      chartLiquidHeight2: first.chartLiquidHeight2 ?? '',
      chartLiquidHeight3: first.chartLiquidHeight3 ?? '',
      depotUllage1: first.depotUllage1 ?? first.depotUllage ?? '',
      depotUllage2: first.depotUllage2 ?? '',
      depotUllage3: first.depotUllage3 ?? '',
      depotLiquidHeight1: first.depotLiquidHeight1 ?? first.depotLiquidHeight ?? '',
      depotLiquidHeight2: first.depotLiquidHeight2 ?? '',
      depotLiquidHeight3: first.depotLiquidHeight3 ?? '',
      stationUllage1: first.stationUllage1 ?? first.stationUllage ?? '',
      stationUllage2: first.stationUllage2 ?? '',
      stationUllage3: first.stationUllage3 ?? '',
      stationLiquidHeight1: first.stationLiquidHeight1 ?? first.stationLiquidHeight ?? '',
      stationLiquidHeight2: first.stationLiquidHeight2 ?? '',
      stationLiquidHeight3: first.stationLiquidHeight3 ?? '',
      firstCompartment: first.firstCompartment ?? '',
      secondCompartment: first.secondCompartment ?? '',
      thirdCompartment: first.thirdCompartment ?? '',
      tankVolumes,
      depotName: first.depotName || '',
      arrivalTime: first.arrivalTime || '',
      exitTime: first.exitTime || '',
      notes: first.notes || '',
    }
  })
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
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])

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
          setEntries(groupRecordsIntoEntries([entry], tnk))
        }
      } else if (editDate) {
        const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(groupRecordsIntoEntries(dateEntries, tnk))
        }
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today)
        if (dateEntries.length > 0 && !cancelled) {
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(groupRecordsIntoEntries(dateEntries, tnk))
        }
      }

      if (!cancelled) {
        const allReceipts = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allReceipts.map(e => e.entryDate).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setEntries(prev => prev.length > 0 ? prev : [blankEntry(tnk)])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(groupRecordsIntoEntries(dateEntries, tanks))
    } else {
      setOriginalIds([])
      setEntries([blankEntry(tanks)])
    }
  }

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

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()

      // Delete all old records when editing
      if (isEditing) {
        for (const id of originalIds) {
          await productReceiptsRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        // Create one record per tank with volume > 0
        const tanksWithVolume = Object.entries(entry.tankVolumes || {}).filter(([, v]) => Number(v) > 0)

        for (const [tankId, volumeStr] of tanksWithVolume) {
          const record = {
            id: crypto.randomUUID(),
            orgId,
            entryDate: formDate,
            loadedDate: entry.loadedDate || null,
            driverName: entry.driverName,
            waybillNumber: entry.waybillNumber,
            ticketNumber: entry.ticketNumber,
            truckNumber: entry.truckNumber,
            chartUllage1: Number(entry.chartUllage1) || 0,
            chartUllage2: Number(entry.chartUllage2) || 0,
            chartUllage3: Number(entry.chartUllage3) || 0,
            chartLiquidHeight1: Number(entry.chartLiquidHeight1) || 0,
            chartLiquidHeight2: Number(entry.chartLiquidHeight2) || 0,
            chartLiquidHeight3: Number(entry.chartLiquidHeight3) || 0,
            depotUllage1: Number(entry.depotUllage1) || 0,
            depotUllage2: Number(entry.depotUllage2) || 0,
            depotUllage3: Number(entry.depotUllage3) || 0,
            depotLiquidHeight1: Number(entry.depotLiquidHeight1) || 0,
            depotLiquidHeight2: Number(entry.depotLiquidHeight2) || 0,
            depotLiquidHeight3: Number(entry.depotLiquidHeight3) || 0,
            stationUllage1: Number(entry.stationUllage1) || 0,
            stationUllage2: Number(entry.stationUllage2) || 0,
            stationUllage3: Number(entry.stationUllage3) || 0,
            stationLiquidHeight1: Number(entry.stationLiquidHeight1) || 0,
            stationLiquidHeight2: Number(entry.stationLiquidHeight2) || 0,
            stationLiquidHeight3: Number(entry.stationLiquidHeight3) || 0,
            firstCompartment: Number(entry.firstCompartment) || 0,
            secondCompartment: Number(entry.secondCompartment) || 0,
            thirdCompartment: Number(entry.thirdCompartment) || 0,
            actualVolume: Number(volumeStr) || 0,
            depotName: entry.depotName,
            tankId,
            arrivalTime: entry.arrivalTime || '',
            exitTime: entry.exitTime || '',
            notes: entry.notes,
            createdAt: now,
            updatedAt: now,
          }
          await productReceiptsRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      router.push(`/dashboard/entries/product-receipt/list?${qs}`)
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
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Daily Sales Operations service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  const current = entries[activeTab]

  const currentDateIdx = editDate ? allDates.indexOf(editDate) : -1
  const prevDate = currentDateIdx > 0 ? allDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx < allDates.length - 1 ? allDates[currentDateIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-end mb-6 gap-2">
          {isEditing && editDate && (
            <>
              <button type="button" onClick={() => router.push(`/dashboard/entries/product-receipt?${qs}&edit_date=${prevDate}`)} disabled={!prevDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => router.push(`/dashboard/entries/product-receipt?${qs}&edit_date=${nextDate}`)} disabled={!nextDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
          <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
            <List className="w-4 h-4" /> View Entries
          </Link>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
        {/* Shared date */}
        <div className="border border-gray-300 mb-4">
          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
          <DateInput value={formDate} onChange={handleDateChange} className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50" />
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
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Truck Number</label>
              <input type="text" value={current.truckNumber} onChange={(e) => updateEntry(activeTab, 'truckNumber', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Arrival Time</label>
                <input type="time" value={current.arrivalTime} onChange={(e) => updateEntry(activeTab, 'arrivalTime', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Exit Time</label>
                <input type="time" value={current.exitTime} onChange={(e) => updateEntry(activeTab, 'exitTime', e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Station Ullage</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              {[1, 2, 3].map(n => (
                <div key={n}>
                  <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Comp {n}</label>
                  <input type="number" value={current[`stationUllage${n}`]} onChange={(e) => updateEntry(activeTab, `stationUllage${n}`, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Station Liq. Height</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              {[1, 2, 3].map(n => (
                <div key={n}>
                  <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Comp {n}</label>
                  <input type="number" value={current[`stationLiquidHeight${n}`]} onChange={(e) => updateEntry(activeTab, `stationLiquidHeight${n}`, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Chart Ullage</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              {[1, 2, 3].map(n => (
                <div key={n}>
                  <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Comp {n}</label>
                  <input type="number" value={current[`chartUllage${n}`]} onChange={(e) => updateEntry(activeTab, `chartUllage${n}`, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Chart Liq. Height</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              {[1, 2, 3].map(n => (
                <div key={n}>
                  <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Comp {n}</label>
                  <input type="number" value={current[`chartLiquidHeight${n}`]} onChange={(e) => updateEntry(activeTab, `chartLiquidHeight${n}`, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Depot Ullage</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              {[1, 2, 3].map(n => (
                <div key={n}>
                  <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Comp {n}</label>
                  <input type="number" value={current[`depotUllage${n}`]} onChange={(e) => updateEntry(activeTab, `depotUllage${n}`, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Depot Liq. Height</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              {[1, 2, 3].map(n => (
                <div key={n}>
                  <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Comp {n}</label>
                  <input type="number" value={current[`depotLiquidHeight${n}`]} onChange={(e) => updateEntry(activeTab, `depotLiquidHeight${n}`, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                </div>
              ))}
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
            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Volume Received Per Tank</span>
            </div>
            {tanks.map((t) => (
              <div key={t.id} className="grid grid-cols-2 divide-x divide-gray-300">
                <div className="flex items-center px-3 py-2.5 bg-gray-50/50">
                  <span className="text-xs text-gray-600">{t.fuel_type} Tank {t.tank_number}</span>
                </div>
                <div>
                  <input
                    type="number"
                    value={current.tankVolumes?.[t.id] || ''}
                    onChange={(e) => {
                      const updated = { ...current.tankVolumes, [t.id]: e.target.value }
                      updateEntry(activeTab, 'tankVolumes', updated)
                    }}
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
              <textarea value={current.notes} onChange={(e) => updateEntry(activeTab, 'notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving || saved} className={`flex items-center gap-2 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && <Check className="w-4 h-4" />}
            {saved ? 'Saved!' : isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>
    </div>
  )
}
