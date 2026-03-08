'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'

export default function ProductReceiptFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const qs = `org_id=${orgId}`
  const API = '/api/entries/product-receipt'

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [tanks, setTanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    loaded_date: '', driver_name: '', waybill_number: '', ticket_number: '', truck_number: '',
    chart_ullage: '', chart_liquid_height: '', depot_ullage: '', depot_liquid_height: '',
    station_ullage: '', station_liquid_height: '',
    first_compartment: '', second_compartment: '', third_compartment: '',
    actual_volume: '', depot_name: '', tank_id: '', notes: '',
  })

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const populateForm = (entry) => {
    setForm({
      entry_date: entry.entry_date || '',
      loaded_date: entry.loaded_date || '',
      driver_name: entry.driver_name || '',
      waybill_number: entry.waybill_number || '',
      ticket_number: entry.ticket_number || '',
      truck_number: entry.truck_number || '',
      chart_ullage: entry.chart_ullage ?? '',
      chart_liquid_height: entry.chart_liquid_height ?? '',
      depot_ullage: entry.depot_ullage ?? '',
      depot_liquid_height: entry.depot_liquid_height ?? '',
      station_ullage: entry.station_ullage ?? '',
      station_liquid_height: entry.station_liquid_height ?? '',
      first_compartment: entry.first_compartment ?? '',
      second_compartment: entry.second_compartment ?? '',
      third_compartment: entry.third_compartment ?? '',
      actual_volume: entry.actual_volume ?? '',
      depot_name: entry.depot_name || '',
      tank_id: entry.tank_id || '',
      notes: entry.notes || '',
    })
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const tankRes = await fetch(`/api/entries/tanks?${qs}`)
      if (tankRes.status === 403) { setLocked(true); setLoading(false); return }
      if (tankRes.ok) {
        const tankData = await tankRes.json()
        if (!cancelled) setTanks(tankData.tanks || [])
      }

      if (editId) {
        const res = await fetch(`${API}?id=${editId}&${qs}`)
        if (res.ok) {
          const data = await res.json()
          if (data.entry && !cancelled) populateForm(data.entry)
        }
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [editId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.entry_date) { setError('Date is required'); return }
    setSaving(true)
    setError('')

    const body = { ...form }
    if (editId) body.id = editId

    const res = await fetch(`${API}?${qs}`, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push(`/dashboard/entries/product-receipt/list?${qs}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await fetch(`${API}?${qs}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId }) })
    router.push(`/dashboard/entries/product-receipt/list?${qs}`)
  }

  const Field = ({ label, name, type = 'text', placeholder }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setField(name, e.target.value)}
        placeholder={placeholder}
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? '0' : undefined}
        className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

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

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Edit Entry' : 'New Product Receipt'}</h1>
        <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Entry Date" name="entry_date" type="date" />
          <Field label="Loaded Date" name="loaded_date" type="date" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Driver Name" name="driver_name" />
          <Field label="Waybill Number" name="waybill_number" />
          <Field label="Ticket Number" name="ticket_number" />
          <Field label="Truck Number" name="truck_number" />
          <Field label="Depot Name" name="depot_name" />
        </div>

        <p className="text-xs font-semibold text-gray-700 pt-2">Chart / Depot / Station</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Chart Ullage" name="chart_ullage" type="number" />
          <Field label="Chart Liquid Height" name="chart_liquid_height" type="number" />
          <Field label="Depot Ullage" name="depot_ullage" type="number" />
          <Field label="Depot Liquid Height" name="depot_liquid_height" type="number" />
          <Field label="Station Ullage" name="station_ullage" type="number" />
          <Field label="Station Liquid Height" name="station_liquid_height" type="number" />
        </div>

        <p className="text-xs font-semibold text-gray-700 pt-2">Compartments</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="1st Compartment" name="first_compartment" type="number" />
          <Field label="2nd Compartment" name="second_compartment" type="number" />
          <Field label="3rd Compartment" name="third_compartment" type="number" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Actual Volume" name="actual_volume" type="number" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Receiving Tank</label>
            <select value={form.tank_id} onChange={(e) => setField('tank_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select tank</option>
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>Tank {t.tank_number} ({t.fuel_type})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          {editId && <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
          <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
