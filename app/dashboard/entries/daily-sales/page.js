'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, AlertTriangle, Lock, Plus, ChevronLeft, ChevronRight, User, X, Check } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { dailySalesRepo } from '@/lib/repositories/dailySales'
import DateInput from '@/components/DateInput'
import Toggle from '@/components/Toggle'
import { useSavePush } from '@/components/SavePushProvider'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { fmtDate } from '@/lib/formatDate'
import { isDefaultAccount } from '@/lib/defaultAccounts'

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
      pour_back_customer_id: '',
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
        pour_back_customer_id: match?.pour_back_customer_id || '',
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
  const { promptPush } = useSavePush()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'fuel-operations')

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [customers, setCustomers] = useState([])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [originalIds, setOriginalIds] = useState([])
  // The date this form was LOADED from. Deletion targets this, never formDate, because the
  // date field is editable and a half-typed change would otherwise clear the wrong day.
  const [loadedDate, setLoadedDate] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingDay, setDeletingDay] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  // Previous day's last closing meter per pump_id — used when the user leaves a nozzle blank
  const [prevClosing, setPrevClosing] = useState({})
  const [prevTankClosing, setPrevTankClosing] = useState({})
  const [allDates, setAllDates] = useState([])
  const [consModal, setConsModal] = useState(null) // { entryIdx, nozzleIdx, type: 'consumption' | 'pour_back' }
  // Fields already offered the sheet once. Without this, every blur re-opens it and the
  // form becomes impossible to tab through after declining once.
  const autoPrompted = useRef(new Set())

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

      if (editId) {
        const entry = await dailySalesRepo.getById(editId)
        if (entry && !cancelled) {
          const date = entry.entryDate || entry.entry_date || ''
          setFormDate(date)
          setLoadedDate(date)
          setOriginalIds([entry.id])
          const built = [entryFromRecord(entry, noz, tnk)]
          setEntries(built)
        }
      } else if (editDate) {
        const all = await db.dailySales.where('orgId').equals(orgId).toArray()
        const dateEntries = all
          .filter(e => (e.entryDate || e.entry_date) === editDate)
          .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0))
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setLoadedDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          const built = dateEntries.map(e => entryFromRecord(e, noz, tnk))
          setEntries(built)
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
          setEntries(built)
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

      if (!prevEntries.length) { setPrevClosing({}); setPrevTankClosing({}); return }

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

      const tankMap = {}
      for (const r of (lastEntry?.tankReadings || lastEntry?.tank_readings || [])) {
        if (r.tank_id != null && r.closing_stock != null) {
          tankMap[r.tank_id] = r.closing_stock
        }
      }
      setPrevTankClosing(tankMap)
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
  // Only the station's default accounts (Police, Generator, Pour Back After Pump Repairs
  // and so on). A credit customer is not what consumption or pour back is booked to, and
  // listing every customer made the picker a search box for a list of about twenty.
  const defaultAccounts = customers
    .filter(isDefaultAccount)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  /**
   * Offer the account sheet when a consumption or pour-back field is left with a value and
   * no account attached — that pairing is always required, and it was easy to key a figure
   * and walk away without it. Offered once per field so declining is respected; the person
   * icon beside the field reopens it.
   */
  const maybePromptAccount = (entryIdx, nozzleIdx, type) => {
    const reading = entries[entryIdx]?.nozzleReadings?.[nozzleIdx]
    if (!reading) return
    const value = type === 'pour_back' ? reading.pour_back : reading.consumption
    if (!(Number(value) > 0)) return
    const field = type === 'pour_back' ? 'pour_back_customer_id' : 'consumption_customer_id'
    if (reading[field]) return
    const key = `${entryIdx}:${nozzleIdx}:${type}`
    if (autoPrompted.current.has(key)) return
    autoPrompted.current.add(key)
    setConsModal({ entryIdx, nozzleIdx, type })
  }

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
          pour_back_customer_id: r.pour_back_customer_id || '',
        }))
        const tankData = entry.tankReadings.map(r => ({
          tank_id: r.tank_id,
          tank_label: r.label,
          closing_stock: r.closing_stock !== '' && r.closing_stock !== undefined
            ? Number(r.closing_stock)
            : Number(prevTankClosing[r.tank_id] ?? 0),
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

      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/daily-sales/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  const deleteWholeDay = async () => {
    if (!loadedDate) return
    setDeletingDay(true)
    setDeleteError('')
    try {
      await dailySalesRepo.removeByDate(orgId, loadedDate)
      router.push(`/dashboard/entries/daily-sales/list?${qs}`)
    } catch (err) {
      // Shown rather than swallowed: a half-cleared day is worth knowing about immediately.
      setDeleteError(`Could not delete: ${err?.message || err}`)
      setDeletingDay(false)
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
            if (!allFields[i].hasAttribute('data-skip-enter')) { allFields[i].focus(); return }
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
                <input type="text" inputMode="decimal" data-skip-enter value={current.prices.PMS} onChange={(e) => updatePrice(activeTab, 'PMS', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">AGO</label>
                <input type="text" inputMode="decimal" data-skip-enter value={current.prices.AGO} onChange={(e) => updatePrice(activeTab, 'AGO', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">DPK</label>
                <input type="text" inputMode="decimal" data-skip-enter value={current.prices.DPK} onChange={(e) => updatePrice(activeTab, 'DPK', e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
              </div>
            </div>

            {current.nozzleReadings.length > 0 && (
              <>
                <div className="bg-gray-50 px-2 py-1">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Nozzle Readings</span>
                  <span className="text-xs text-gray-400 ml-2">— leave blank to use prev. day closing</span>
                </div>
                {current.nozzleReadings.map((r, idx) => {
                  const consHasValue = Number(r.consumption) > 0
                  const pbHasValue = Number(r.pour_back) > 0
                  const consCustName = consHasValue && r.consumption_customer_id
                    ? customers.find(c => c.id === r.consumption_customer_id)?.name
                    : null
                  const pbCustName = pbHasValue && r.pour_back_customer_id
                    ? customers.find(c => c.id === r.pour_back_customer_id)?.name
                    : null
                  return (
                    <div key={r.pump_id}>
                      <div className="grid grid-cols-[2fr_1fr_1fr] divide-x divide-gray-300">
                        <div>
                          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">{r.label}</label>
                          <input
                            type="text" inputMode="decimal" enterKeyHint="next"
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
                            <input type="text" inputMode="decimal" data-skip-enter value={r.consumption} onChange={(e) => updateNozzleReading(activeTab, idx, 'consumption', e.target.value)} onBlur={() => maybePromptAccount(activeTab, idx, 'consumption')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                            {consHasValue && (
                              <button type="button" onClick={() => setConsModal({ entryIdx: activeTab, nozzleIdx: idx, type: 'consumption' })} className={`flex-shrink-0 mr-1.5 p-1 rounded ${consCustName ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`} title={consCustName || 'Attach account'}>
                                <User className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">P.B.</label>
                          <div className="flex items-center">
                            <input type="text" inputMode="decimal" data-skip-enter value={r.pour_back} onChange={(e) => updateNozzleReading(activeTab, idx, 'pour_back', e.target.value)} onBlur={() => maybePromptAccount(activeTab, idx, 'pour_back')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                            {pbHasValue && (
                              <button type="button" onClick={() => setConsModal({ entryIdx: activeTab, nozzleIdx: idx, type: 'pour_back' })} className={`flex-shrink-0 mr-1.5 p-1 rounded ${pbCustName ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`} title={pbCustName || 'Attach account'}>
                                <User className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {(consCustName || pbCustName) && (
                        <div className="px-2 pb-0.5 -mt-0.5 space-x-2">
                          {consCustName && <span className="text-xs text-blue-600">Cons: {consCustName}</span>}
                          {pbCustName && <span className="text-xs text-blue-600">P.B.: {pbCustName}</span>}
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
                      <input type="text" inputMode="decimal" enterKeyHint="next" value={r.closing_stock} onChange={(e) => updateTankReading(activeTab, idx, e.target.value)} step="0.01" min="0" placeholder={prevTankClosing[r.tank_id] != null ? String(prevTankClosing[r.tank_id]) : ''} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
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
              <textarea data-skip-enter value={current.notes} onChange={(e) => updateEntry(activeTab, 'notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
            </div>
          </div>
        )}

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
          <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving || saved || (!subLoading && !isSubscribed)} className={`flex items-center gap-2 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && <Check className="w-4 h-4" />}
            {saved ? 'Saved!' : isEditing ? 'Update' : 'Save All'}
          </button>
        </div>
      </form>

      {/* Danger zone — outside the <form> so the button can never submit it. Only offered
          when a saved day is open: there is nothing to delete on a fresh entry. */}
      {isEditing && loadedDate && (
        <div className="mt-10 border border-red-200 bg-red-50/50">
          <div className="px-4 py-3 border-b border-red-200">
            <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Delete this day
            </h3>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-gray-700 mb-3">
              Removes {originalIds.length} saved {originalIds.length === 1 ? 'entry' : 'entries'} for{' '}
              <span className="font-semibold text-gray-900">{fmtDate(loadedDate)}</span> so the day can be entered again from scratch.
            </p>
            <ul className="text-xs text-gray-600 space-y-1 mb-4 list-disc list-inside">
              <li><span className="font-medium text-gray-800">This cannot be undone.</span> Once synced, the entries are gone from the server too.</li>
              <li>Every report covering this date changes — daily sales, audit, analytics, inventory log and sales overview.</li>
              <li>Later days are unaffected: readings chain from each day&apos;s own meters, not from this one.</li>
              <li>Lodgements, product receipts and lube records for {fmtDate(loadedDate)} are <span className="font-medium text-gray-800">not</span> touched. Delete those from their own pages.</li>
              <li>If you only want to correct a figure, close this and edit the entry instead.</li>
            </ul>
            {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
            <button
              type="button"
              onClick={() => { setDeleteError(''); setConfirmDelete(true) }}
              className="flex items-center gap-2 border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" /> Delete all entries for this day
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => (deletingDay ? null : setConfirmDelete(false))}>
          <div className="bg-white w-full sm:max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Delete {fmtDate(loadedDate)}?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                {originalIds.length} {originalIds.length === 1 ? 'entry' : 'entries'} will be permanently deleted. This cannot be undone.
              </p>
              {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deletingDay} className="flex-1 border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={deleteWholeDay} disabled={deletingDay} className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {deletingDay && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deletingDay ? 'Deleting…' : 'Delete day'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consumption / pour-back account sheet.
          A bottom sheet rather than a centred dialog: this is filled in one-handed on a
          phone at the pump, so the choices belong within thumb reach. It lists the station's
          default accounts only, one tap to pick — no search box for a list this short. */}
      {consModal && (() => {
        const r = entries[consModal.entryIdx]?.nozzleReadings[consModal.nozzleIdx]
        if (!r) return null
        const field = consModal.type === 'pour_back' ? 'pour_back_customer_id' : 'consumption_customer_id'
        const heading = consModal.type === 'pour_back' ? 'Pour Back Account' : 'Consumption Account'
        const currentValue = r[field]
        const litres = consModal.type === 'pour_back' ? r.pour_back : r.consumption
        const pick = (val) => {
          updateNozzleReading(consModal.entryIdx, consModal.nozzleIdx, field, val)
          setConsModal(null)
        }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setConsModal(null)}>
            <div className="bg-white w-full sm:max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
                  <p className="text-xs text-gray-500">{r.label} · {Number(litres) || 0}L</p>
                </div>
                <button type="button" onClick={() => setConsModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-gray-100">
                {defaultAccounts.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">
                    No default accounts set up for this station yet.
                  </p>
                ) : defaultAccounts.map((c) => {
                  const selected = c.id === currentValue
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm ${selected ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-800 hover:bg-gray-50'}`}
                    >
                      <span className="flex-1">{c.name || 'Unnamed'}</span>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {currentValue && (
                <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0"
                     style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                  <button type="button" onClick={() => pick('')} className="text-sm text-red-600 hover:text-red-700">
                    Remove account
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
