'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'

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

  // Load nozzles and tanks config
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [nozRes, tankRes] = await Promise.all([
        fetch(`/api/entries/nozzles?${qs}`),
        fetch(`/api/entries/tanks?${qs}`),
      ])

      if (nozRes.status === 403 || tankRes.status === 403) {
        setLocked(true)
        setLoading(false)
        return
      }

      const nozData = nozRes.ok ? await nozRes.json() : { nozzles: [] }
      const tankData = tankRes.ok ? await tankRes.json() : { tanks: [] }

      if (cancelled) return
      const noz = nozData.nozzles || []
      const tnk = tankData.tanks || []
      setNozzles(noz)
      setTanks(tnk)

      // If editing, load the entry by ID and populate form
      if (editId) {
        const res = await fetch(`/api/entries/daily-sales?id=${editId}&${qs}`)
        if (res.ok) {
          const data = await res.json()
          if (data.entry && !cancelled) {
            populateForm(data.entry, noz, tnk)
            setLoading(false)
            return
          }
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
  }, [editId])

  const populateForm = (entry, noz, tnk) => {
    setFormDate(entry.entry_date)
    const p = entry.prices || {}
    setPrices({ PMS: String(p.PMS || ''), AGO: String(p.AGO || ''), DPK: String(p.DPK || '') })
    setNotes(entry.notes || '')

    const savedNozzles = entry.nozzle_readings || []
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

    const savedTanks = entry.tank_readings || []
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
    const missingTank = tankReadings.find((r) => r.closing_stock === '' || r.closing_stock === undefined)
    if (missingTank) { setError(`Closing stock is required for ${missingTank.label}`); return }
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

    const body = {
      entry_date: formDate,
      nozzle_readings: readings,
      tank_readings: tankData,
      prices: {
        PMS: Number(prices.PMS) || 0,
        AGO: Number(prices.AGO) || 0,
        DPK: Number(prices.DPK) || 0,
      },
      notes,
    }

    if (editId) body.id = editId

    const res = await fetch(`/api/entries/daily-sales?${qs}`, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push(`/dashboard/entries/daily-sales/list?${qs}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await fetch(`/api/entries/daily-sales?${qs}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId }),
    })
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

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full sm:w-48 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Fuel Prices (₦/litre)</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">PMS</label>
              <input type="number" value={prices.PMS} onChange={(e) => setPrices((p) => ({ ...p, PMS: e.target.value }))} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">AGO</label>
              <input type="number" value={prices.AGO} onChange={(e) => setPrices((p) => ({ ...p, AGO: e.target.value }))} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">DPK</label>
              <input type="number" value={prices.DPK} onChange={(e) => setPrices((p) => ({ ...p, DPK: e.target.value }))} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Nozzle readings */}
        {nozzleReadings.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Nozzle Readings</label>
            <div className="space-y-2">
              {nozzleReadings.map((r, idx) => (
                <div key={r.pump_id}>
                  <p className="text-sm font-medium text-gray-700 mb-1">{r.label}</p>
                  <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Closing Meter</label>
                      <input type="number" value={r.closing_meter} onChange={(e) => updateReading(idx, 'closing_meter', e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Consumption</label>
                      <input type="number" value={r.consumption} onChange={(e) => updateReading(idx, 'consumption', e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pour Back</label>
                      <input type="number" value={r.pour_back} onChange={(e) => updateReading(idx, 'pour_back', e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nozzles.length === 0 && (
          <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 p-3">
            No nozzles found. Please check your station setup or try refreshing the page.
          </p>
        )}

        {/* Tank readings */}
        {tankReadings.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">UGT Closing Stock</label>
            <div className="space-y-2">
              {tankReadings.map((r, idx) => (
                <div key={r.tank_id}>
                  <p className="text-sm font-medium text-gray-700 mb-1">{r.label}</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Closing Stock (litres)</label>
                    <input type="number" value={r.closing_stock} onChange={(e) => updateTankReading(idx, e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tanks.length === 0 && (
          <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 p-3">
            No tanks found. Please check your station setup or try refreshing the page.
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
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
