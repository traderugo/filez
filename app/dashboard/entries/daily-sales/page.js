'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { dailySalesRepo } from '@/lib/repositories/dailySales'
import { initialSync } from '@/lib/initialSync'
import { startSync } from '@/lib/sync'
import Toggle from '@/components/Toggle'

export default function DailySalesFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])

  // Form state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [nozzleReadings, setNozzleReadings] = useState([])
  const [tankReadings, setTankReadings] = useState([])
  const [prices, setPrices] = useState({ PMS: '', AGO: '', DPK: '' })
  const [notes, setNotes] = useState('')
  const [closeOfBusiness, setCloseOfBusiness] = useState(false)

  // Load config from IndexedDB, trigger initial sync if needed
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      // Ensure data is synced (no-op if already done)
      try { await initialSync(orgId) } catch (e) { /* offline */ }
      // Start background sync engine
      try { startSync() } catch (e) { /* offline */ }

      if (cancelled) return

      // Read config from IndexedDB
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

      // If editing, load the entry from IndexedDB
      if (editId) {
        const entry = await dailySalesRepo.getById(editId)
        if (entry && !cancelled) {
          populateForm(entry, noz, tnk)
          setLoading(false)
          return
        }
      }

      // New entry — initialize empty readings
      if (!cancelled) {
        setNozzleReadings(noz.map((n) => ({
          pump_id: n.id,
          label: `${n.fuel_type} ${n.pump_number}`,
          closing_meter: '',
          consumption: '',
          pour_back: '',
        })))
        setTankReadings(tnk.map((t) => ({
          tank_id: t.id,
          label: `${t.fuel_type} Tank ${t.tank_number}`,
          closing_stock: '',
        })))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, orgId])

  const populateForm = (entry, noz, tnk) => {
    setFormDate(entry.entryDate || entry.entry_date)
    const p = entry.prices || {}
    setPrices({ PMS: String(p.PMS || ''), AGO: String(p.AGO || ''), DPK: String(p.DPK || '') })
    setNotes(entry.notes || '')
    setCloseOfBusiness(entry.closeOfBusiness || entry.close_of_business || false)

    const savedNozzles = entry.nozzleReadings || entry.nozzle_readings || []
    setNozzleReadings(noz.map((n) => {
      const match = savedNozzles.find((r) => r.pump_id === n.id)
      return {
        pump_id: n.id,
        label: `${n.fuel_type} ${n.pump_number}`,
        closing_meter: match ? String(match.closing_meter || '') : '',
        consumption: match ? String(match.consumption || '') : '',
        pour_back: match ? String(match.pour_back || '') : '',
      }
    }))

    const savedTanks = entry.tankReadings || entry.tank_readings || []
    setTankReadings(tnk.map((t) => {
      const match = savedTanks.find((r) => r.tank_id === t.id)
      return {
        tank_id: t.id,
        label: `${t.fuel_type} Tank ${t.tank_number}`,
        closing_stock: match ? String(match.closing_stock || '') : '',
      }
    }))
  }

  const updateReading = (idx, field, value) => {
    setNozzleReadings((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const updateTankReading = (idx, value) => {
    setTankReadings((prev) => prev.map((r, i) => i === idx ? { ...r, closing_stock: value } : r))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!prices.PMS && !prices.AGO && !prices.DPK) { setError('At least one fuel price is required'); return }
    if (closeOfBusiness) {
      const missingTank = tankReadings.find((r) => r.closing_stock === '' || r.closing_stock === undefined)
      if (missingTank) { setError(`Closing stock is required for ${missingTank.label}`); return }
    }
    const missingReading = nozzleReadings.find((r) => r.closing_meter === '' || r.closing_meter === undefined)
    if (missingReading) { setError(`Closing meter is required for ${missingReading.label}`); return }

    setSaving(true)
    setError('')

    const readings = nozzleReadings.map((r) => ({
      pump_id: r.pump_id,
      nozzle_label: r.label,
      closing_meter: Number(r.closing_meter) || 0,
      consumption: Number(r.consumption) || 0,
      pour_back: Number(r.pour_back) || 0,
    }))

    const tankData = tankReadings.map((r) => ({
      tank_id: r.tank_id,
      tank_label: r.label,
      closing_stock: Number(r.closing_stock) || 0,
    }))

    const record = {
      id: editId || crypto.randomUUID(),
      orgId,
      entryDate: formDate,
      nozzleReadings: readings,
      tankReadings: tankData,
      prices: {
        PMS: Number(prices.PMS) || 0,
        AGO: Number(prices.AGO) || 0,
        DPK: Number(prices.DPK) || 0,
      },
      closeOfBusiness,
      notes,
      createdAt: editId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editId) {
        // Preserve existing fields when updating
        const existing = await dailySalesRepo.getById(editId)
        await dailySalesRepo.update({ ...existing, ...record })
      } else {
        await dailySalesRepo.create(record)
      }
      router.push(`/dashboard/entries/daily-sales/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await dailySalesRepo.remove(editId, orgId)
    router.push(`/dashboard/entries/daily-sales/list?${qs}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

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

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Edit Entry' : 'New Daily Sales Entry'}</h1>
        <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
        <div className="border border-gray-300 divide-y divide-gray-300">
          <div>
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
          <div className="bg-gray-50 px-2 py-1">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Fuel Prices (₦/litre)</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">PMS</label>
              <input type="number" value={prices.PMS} onChange={(e) => setPrices((p) => ({ ...p, PMS: e.target.value }))} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">AGO</label>
              <input type="number" value={prices.AGO} onChange={(e) => setPrices((p) => ({ ...p, AGO: e.target.value }))} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">DPK</label>
              <input type="number" value={prices.DPK} onChange={(e) => setPrices((p) => ({ ...p, DPK: e.target.value }))} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>

          {/* Nozzle readings */}
          {nozzleReadings.length > 0 && (
            <>
              <div className="bg-gray-50 px-2 py-1">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Nozzle Readings</span>
              </div>
              {nozzleReadings.map((r, idx) => (
                <div key={r.pump_id}>
                  <div className="bg-gray-50/50 px-2 py-0.5 border-b border-gray-200">
                    <span className="text-xs text-gray-600 font-medium">{r.label}</span>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr_1fr] divide-x divide-gray-300">
                    <div>
                      <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Closing Meter</label>
                      <input type="number" value={r.closing_meter} onChange={(e) => updateReading(idx, 'closing_meter', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Cons.</label>
                      <input type="number" value={r.consumption} onChange={(e) => updateReading(idx, 'consumption', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">P/b</label>
                      <input type="number" value={r.pour_back} onChange={(e) => updateReading(idx, 'pour_back', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {nozzles.length === 0 && (
            <div className="px-2 py-3">
              <p className="text-sm text-yellow-700">No nozzles found. Check your station setup or refresh.</p>
            </div>
          )}

          {/* Close of Business checkbox + Tank readings */}
          {tankReadings.length > 0 && (
            <>
              <div className="bg-gray-50 px-2 py-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">UGT Closing Stock</span>
                <Toggle checked={closeOfBusiness} onChange={setCloseOfBusiness} label="Final entry" />
              </div>
              {closeOfBusiness && tankReadings.map((r, idx) => (
                <div key={r.tank_id} className="grid grid-cols-2 divide-x divide-gray-300">
                  <div className="flex items-center px-3 py-2.5 bg-gray-50/50">
                    <span className="text-xs text-gray-600">{r.label}</span>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Litres</label>
                    <input type="number" value={r.closing_stock} onChange={(e) => updateTankReading(idx, e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
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
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
          {editId && <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
          <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
