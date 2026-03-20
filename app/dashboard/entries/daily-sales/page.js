'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock, Plus, ChevronLeft, ChevronRight, User, X } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { consumptionRepo } from '@/lib/repositories/consumption'
import { dailySalesRepo } from '@/lib/repositories/dailySales'
import DateInput from '@/components/DateInput'
import Toggle from '@/components/Toggle'
import SearchableSelect from '@/components/SearchableSelect'

function blankEntry(nozzles, tanks) {
  return {
    _key: crypto.randomUUID(),
    id: null,
    nozzleReadings: nozzles.map(n => ({
      pump_id: n.id,
      label: `${n.fuel_type} ${n.pump_number}`,
      fuel_type: n.fuel_type,
      closing_meter: '',
      consumption: '',
      pour_back: '',
      consumption_customer_id: '',
    })),
    tankReadings: tanks.map(t => ({
      tank_id: t.id,
      label: `${t.fuel_type} Tank ${t.tank_number}`,
      closing_stock: '',
    })),
    prices: { PMS: '', AGO: '', DPK: '' },
    closeOfBusiness: false,
    notes: '',
  }
}

function entryFromRecord(entry, nozzles, tanks) {
  const savedNozzles = entry.nozzleReadings || entry.nozzle_readings || []
  const savedTanks = entry.tankReadings || entry.tank_readings || []
  const p = entry.prices || {}
  return {
    _key: entry.id,
    id: entry.id,
    nozzleReadings: nozzles.map(n => {
      const match = savedNozzles.find(r => r.pump_id === n.id)
      return {
        pump_id: n.id,
        label: `${n.fuel_type} ${n.pump_number}`,
        fuel_type: n.fuel_type,
        closing_meter: match ? String(match.closing_meter || '') : '',
        consumption: match ? String(match.consumption || '') : '',
        pour_back: match ? String(match.pour_back || '') : '',
        consumption_customer_id: match?.consumption_customer_id || '',
      }
    }),
    tankReadings: tanks.map(t => {
      const match = savedTanks.find(r => r.tank_id === t.id)
      return {
        tank_id: t.id,
        label: `${t.fuel_type} Tank ${t.tank_number}`,
        closing_stock: match ? String(match.closing_stock || '') : '',
      }
    }),
    prices: { PMS: String(p.PMS || ''), AGO: String(p.AGO || ''), DPK: String(p.DPK || '') },
    closeOfBusiness: entry.closeOfBusiness || entry.close_of_business || false,
    notes: entry.notes || '',
  }
}

export default function DailySalesFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [customers, setCustomers] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [originalIds, setOriginalIds] = useState([])
  // Previous day's last closing meter per pump_id — used when the user leaves a nozzle blank
  const [prevClosing, setPrevClosing] = useState({})
  const [allDates, setAllDates] = useState([])
  const [consModal, setConsModal] = useState(null) // { entryIdx, nozzleIdx }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const noz = await db.nozzles.where('orgId').equals(orgId).toArray()
      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()

      if (noz.length === 0 && tnk.length === 0) {
        setLocked(true)
        setLoading(false)
        return
      }

      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)

      const cust = await db.customers.where('orgId').equals(orgId).toArray()
      cust.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setCustomers(cust)

      // Backfill missing consumption_customer_id from consumption_entries in IndexedDB
      async function backfillCustomerIds(formEntries, date) {
        const consEntries = await db.consumption
          .where('orgId').equals(orgId)
          .filter(c => c.entryDate === date)
          .toArray()
        if (!consEntries.length) return formEntries

        return formEntries.map(fe => ({
          ...fe,
          nozzleReadings: fe.nozzleReadings.map(r => {
            if (r.consumption_customer_id || !Number(r.consumption)) return r
            // Match by fuel type and quantity
            const match = consEntries.find(c =>
              c.fuelType === r.fuel_type && c.quantity === Number(r.consumption)
            )
            if (match) return { ...r, consumption_customer_id: match.customerId }
            // Fall back to matching by fuel type only (single customer for that fuel)
            const byFuel = consEntries.filter(c => c.fuelType === r.fuel_type)
            if (byFuel.length === 1) return { ...r, consumption_customer_id: byFuel[0].customerId }
            return r
          }),
        }))
      }

      if (editId) {
        const entry = await dailySalesRepo.getById(editId)
        if (entry && !cancelled) {
          const date = entry.entryDate || entry.entry_date || ''
          setFormDate(date)
          setOriginalIds([entry.id])
          const built = [entryFromRecord(entry, noz, tnk)]
          setEntries(await backfillCustomerIds(built, date))
        }
      } else if (editDate) {
        const all = await db.dailySales.where('orgId').equals(orgId).toArray()
        const dateEntries = all
          .filter(e => (e.entryDate || e.entry_date) === editDate)
          .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0))
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          const built = dateEntries.map(e => entryFromRecord(e, noz, tnk))
          setEntries(await backfillCustomerIds(built, editDate))
        }
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.dailySales.where('orgId').equals(orgId).toArray()
        const dateEntries = all
          .filter(e => (e.entryDate || e.entry_date) === today)
          .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0))
        if (dateEntries.length > 0 && !cancelled) {
          setOriginalIds(dateEntries.map(e => e.id))
          const built = dateEntries.map(e => entryFromRecord(e, noz, tnk))
          setEntries(await backfillCustomerIds(built, today))
        }
      }

      if (!cancelled) {
        const allSales = await db.dailySales.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allSales.map(e => e.entryDate || e.entry_date).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setEntries(prev => prev.length > 0 ? prev : [blankEntry(noz, tnk)])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  // Resolve the previous day's last closing meter readings from IndexedDB
  useEffect(() => {
    if (!orgId || !formDate) return
    const load = async () => {
      // Find the last entry before formDate (any previous date, not just yesterday)
      const allSales = await db.dailySales.where('orgId').equals(orgId).toArray()
      const prevEntries = allSales
        .filter(e => (e.entryDate || e.entry_date) < formDate)
        .sort((a, b) => (b.entryDate || b.entry_date || '').localeCompare(a.entryDate || a.entry_date || ''))

      if (!prevEntries.length) { setPrevClosing({}); return }

      // Get entries from the most recent previous date
      const lastDate = prevEntries[0].entryDate || prevEntries[0].entry_date
      const lastDateEntries = prevEntries.filter(e => (e.entryDate || e.entry_date) === lastDate)

      // Prefer the close-of-business entry; otherwise use the latest by createdAt
      const lastEntry =
        lastDateEntries.find(e => e.closeOfBusiness || e.close_of_business) ||
        lastDateEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]

      const map = {}
      for (const r of (lastEntry?.nozzleReadings || [])) {
        if (r.pump_id != null && r.closing_meter != null) {
          map[r.pump_id] = r.closing_meter
        }
      }
      setPrevClosing(map)
    }
    load()
  }, [orgId, formDate])

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.dailySales.where('orgId').equals(orgId).toArray()
    const dateEntries = all
      .filter(e => (e.entryDate || e.entry_date) === newDate)
      .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0))
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => entryFromRecord(e, nozzles, tanks)))
    } else {
      setOriginalIds([])
      setEntries([blankEntry(nozzles, tanks)])
    }
  }

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const updateNozzleReading = (entryIdx, nozzleIdx, field, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, nozzleReadings: e.nozzleReadings.map((r, j) => j === nozzleIdx ? { ...r, [field]: value } : r) }
    }))
  }

  const updateTankReading = (entryIdx, tankIdx, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, tankReadings: e.tankReadings.map((r, j) => j === tankIdx ? { ...r, closing_stock: value } : r) }
    }))
  }

  const updatePrice = (entryIdx, fuel, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, prices: { ...e.prices, [fuel]: value } }
    }))
  }

  const addEntry = () => {
    setEntries(prev => [...prev, blankEntry(nozzles, tanks)])
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

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (!entry.prices.PMS && !entry.prices.AGO && !entry.prices.DPK) {
        setError(`Entry ${i + 1}: At least one fuel price is required`); setActiveTab(i); submittingRef.current = false; return
      }
      if (entry.closeOfBusiness) {
        const missingTank = entry.tankReadings.find(r => r.closing_stock === '' || r.closing_stock === undefined)
        if (missingTank) {
          setError(`Entry ${i + 1}: Closing stock is required for ${missingTank.label}`); setActiveTab(i); submittingRef.current = false; return
        }
      }
    }

    const cobEntries = entries.filter(e => e.closeOfBusiness)
    if (cobEntries.length > 1) {
      setError('Only one entry can be marked as close-of-business'); submittingRef.current = false; return
    }
    if (cobEntries.length === 1) {
      const dateEntries = await db.dailySales.where('orgId').equals(orgId).toArray()
      const existingCob = dateEntries.find(
        e => (e.entryDate || e.entry_date) === formDate
          && (e.closeOfBusiness || e.close_of_business)
          && !originalIds.includes(e.id)
      )
      if (existingCob) {
        setError('A close-of-business entry already exists for this date.'); submittingRef.current = false; return
      }
    }

    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await dailySalesRepo.remove(id, orgId)
        }
      }

      // Delete ALL non-pour-back consumption entries for this date before saving
      const oldCons = await db.consumption
        .where('orgId').equals(orgId)
        .filter(c => c.entryDate === formDate && !c.isPourBack)
        .toArray()
      for (const old of oldCons) {
        await consumptionRepo.remove(old.id, orgId)
      }

      for (const entry of entries) {
        const readings = entry.nozzleReadings.map(r => ({
          pump_id: r.pump_id,
          nozzle_label: r.label,
          fuel_type: r.fuel_type,
          closing_meter: r.closing_meter !== '' && r.closing_meter !== undefined
            ? Number(r.closing_meter)
            : (prevClosing[r.pump_id] ?? 0),
          consumption: Number(r.consumption) || 0,
          pour_back: Number(r.pour_back) || 0,
          consumption_customer_id: r.consumption_customer_id || '',
        }))
        const tankData = entry.tankReadings.map(r => ({
          tank_id: r.tank_id,
          tank_label: r.label,
          closing_stock: Number(r.closing_stock) || 0,
        }))

        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          nozzleReadings: readings,
          tankReadings: tankData,
          prices: {
            PMS: Number(entry.prices.PMS) || 0,
            AGO: Number(entry.prices.AGO) || 0,
            DPK: Number(entry.prices.DPK) || 0,
          },
          closeOfBusiness: entry.closeOfBusiness,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await dailySalesRepo.getById(entry.id)
          await dailySalesRepo.update({ ...existing, ...record })
        } else {
          record.createdAt = now
          await dailySalesRepo.create(record)
        }

        // Recreate consumption entries from nozzle readings
        for (const r of readings) {
          const qty = Number(r.consumption) || 0
          const custId = r.consumption_customer_id
          if (!(qty > 0 && custId)) continue

          const ft = r.fuel_type || ''
          const price = Number(entry.prices[ft]) || 0
          await consumptionRepo.create({
            id: crypto.randomUUID(),
            sourceKey: `${record.id}_${r.pump_id}`,
            orgId,
            entryDate: formDate,
            customerId: custId,
            quantity: qty,
            fuelType: ft,
            isPourBack: false,
            price,
            notes: `${r.nozzle_label || ''} consumption`,
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      router.push(`/dashboard/entries/daily-sales/list?${qs}`)
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

  const current = entries[activeTab]

  const currentDateIdx = editDate ? allDates.indexOf(editDate) : -1
  const prevDate = currentDateIdx > 0 ? allDates[currentDateIdx - 1] : null
  const nextDate = currentDateIdx < allDates.length - 1 ? allDates[currentDateIdx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-end mb-6 gap-2">
          {isEditing && editDate && (
            <>
              <button type="button" onClick={() => router.push(`/dashboard/entries/daily-sales?${qs}&edit_date=${prevDate}`)} disabled={!prevDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => router.push(`/dashboard/entries/daily-sales?${qs}&edit_date=${nextDate}`)} disabled={!nextDate} className="flex items-center justify-center text-sm text-gray-600 border border-gray-300 px-2 py-2 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
          <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
            <List className="w-4 h-4" /> View Entries
          </Link>
      </div>

      <form onSubmit={handleSubmit} onFocus={(e) => { if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) e.target.select() }} onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
          e.preventDefault()
          const allFields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea'))
          const curIdx = allFields.indexOf(e.target)
          if (curIdx < 0) return
          for (let i = curIdx + 1; i < allFields.length; i++) {
            if (!allFields[i].dataset.skipEnter) { allFields[i].focus(); return }
          }
        }
      }}>
        {/* Shared date */}
        <div className="border border-gray-300 mb-4">
          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Date</label>
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

            <div className="bg-gray-50 px-2 py-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Fuel Prices (₦/litre)</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-300">
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">PMS</label>
                <input type="number" value={current.prices.PMS} onChange={(e) => updatePrice(activeTab, 'PMS', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">AGO</label>
                <input type="number" value={current.prices.AGO} onChange={(e) => updatePrice(activeTab, 'AGO', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">DPK</label>
                <input type="number" value={current.prices.DPK} onChange={(e) => updatePrice(activeTab, 'DPK', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>

            {current.nozzleReadings.length > 0 && (
              <>
                <div className="bg-gray-50 px-2 py-1">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Nozzle Readings</span>
                  <span className="text-xs text-gray-400 ml-2">— leave blank to use prev. day closing</span>
                </div>
                {current.nozzleReadings.map((r, idx) => {
                  const custName = Number(r.consumption) > 0 && r.consumption_customer_id
                    ? customers.find(c => c.id === r.consumption_customer_id)?.name
                    : null
                  return (
                    <div key={r.pump_id}>
                      <div className="grid grid-cols-[2fr_1fr] divide-x divide-gray-300">
                        <div>
                          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">{r.label}</label>
                          <input
                            type="number"
                            value={r.closing_meter}
                            onChange={(e) => updateNozzleReading(activeTab, idx, 'closing_meter', e.target.value)}
                            step="0.01"
                            min="0"
                            placeholder={prevClosing[r.pump_id] != null ? String(prevClosing[r.pump_id]) : ''}
                            className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Cons.</label>
                          <div className="flex items-center">
                            <input type="number" data-skip-enter value={r.consumption} onChange={(e) => updateNozzleReading(activeTab, idx, 'consumption', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                            {Number(r.consumption) > 0 && (
                              <button type="button" onClick={() => setConsModal({ entryIdx: activeTab, nozzleIdx: idx })} className={`flex-shrink-0 mr-1.5 p-1 rounded ${custName ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`} title={custName || 'Attach account'}>
                                <User className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {custName && Number(r.consumption) > 0 && (
                        <div className="px-2 pb-0.5 -mt-0.5">
                          <span className="text-xs text-blue-600">{custName}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {nozzles.length === 0 && (
              <div className="px-2 py-3">
                <p className="text-sm text-yellow-700">No nozzles found. Check your station setup or refresh.</p>
              </div>
            )}

            {current.tankReadings.length > 0 && (
              <>
                <div className="bg-gray-50 px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">UGT Closing Stock</span>
                  <Toggle checked={current.closeOfBusiness} onChange={(v) => updateEntry(activeTab, 'closeOfBusiness', v)} label="Final entry" />
                </div>
                {current.closeOfBusiness && current.tankReadings.map((r, idx) => (
                  <div key={r.tank_id} className="grid grid-cols-2 divide-x divide-gray-300">
                    <div className="flex items-center px-3 py-2.5 bg-gray-50/50">
                      <span className="text-xs text-gray-600">{r.label}</span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Litres</label>
                      <input type="number" value={r.closing_stock} onChange={(e) => updateTankReading(activeTab, idx, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                    </div>
                  </div>
                ))}
              </>
            )}

            {tanks.length === 0 && (
              <div className="px-2 py-3">
                <p className="text-sm text-yellow-700">No tanks found. Check your station setup or refresh.</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
              <textarea value={current.notes} onChange={(e) => updateEntry(activeTab, 'notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>

      {/* Consumption account modal */}
      {consModal && (() => {
        const r = entries[consModal.entryIdx]?.nozzleReadings[consModal.nozzleIdx]
        if (!r) return null
        const custName = r.consumption_customer_id ? customers.find(c => c.id === r.consumption_customer_id)?.name : null
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setConsModal(null)}>
            <div className="bg-white w-full sm:max-w-sm sm:rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Consumption Account</h3>
                  <p className="text-xs text-gray-500">{r.label} — {r.consumption} litres</p>
                </div>
                <button type="button" onClick={() => setConsModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <SearchableSelect
                  value={r.consumption_customer_id}
                  onChange={(val) => {
                    updateNozzleReading(consModal.entryIdx, consModal.nozzleIdx, 'consumption_customer_id', val)
                    setConsModal(null)
                  }}
                  options={customers.map(c => ({ value: c.id, label: c.name || 'Unnamed', sub: c.phone || '' }))}
                  placeholder="Select account..."
                  className="text-sm"
                />
                {custName && (
                  <button type="button" onClick={() => { updateNozzleReading(consModal.entryIdx, consModal.nozzleIdx, 'consumption_customer_id', ''); setConsModal(null) }} className="mt-2 text-xs text-red-500 hover:text-red-700">
                    Remove account
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
