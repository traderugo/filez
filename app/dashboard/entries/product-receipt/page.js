'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const API = '/api/entries/product-receipt'

export default function ProductReceiptPage() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [tanks, setTanks] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    loaded_date: '', driver_name: '', waybill_number: '', ticket_number: '', truck_number: '',
    chart_ullage: '', chart_liquid_height: '', depot_ullage: '', depot_liquid_height: '',
    station_ullage: '', station_liquid_height: '',
    first_compartment: '', second_compartment: '', third_compartment: '',
    actual_volume: '', depot_name: '', tank_id: '', notes: '',
  })

  const limit = 10
  const totalPages = Math.ceil(total / limit)

  const loadEntries = async (p = page) => {
    const res = await fetch(`${API}?page=${p}&limit=${limit}`)
    if (res.status === 403) { setLocked(true); setLoading(false); return }
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const tankRes = await fetch('/api/entries/tanks')
      if (tankRes.ok) {
        const tankData = await tankRes.json()
        setTanks(tankData.tanks || [])
      }
      loadEntries()
    }
    init()
  }, [])
  useEffect(() => { loadEntries(page) }, [page])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({
      entry_date: new Date().toISOString().split('T')[0],
      loaded_date: '', driver_name: '', waybill_number: '', ticket_number: '', truck_number: '',
      chart_ullage: '', chart_liquid_height: '', depot_ullage: '', depot_liquid_height: '',
      station_ullage: '', station_liquid_height: '',
      first_compartment: '', second_compartment: '', third_compartment: '',
      actual_volume: '', depot_name: '', tank_id: '', notes: '',
    })
    setError('')
  }

  const openEdit = (entry) => {
    setEditingId(entry.id)
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
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.entry_date) { setError('Date is required'); return }
    setSaving(true)
    setError('')

    const body = { ...form }
    if (editingId) body.id = editingId

    const res = await fetch(API, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) { resetForm(); loadEntries(page) }
    else { const data = await res.json(); setError(data.error || 'Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadEntries(page)
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
        <div>

          <h1 className="text-xl font-bold text-gray-900">Product Receipt</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="border border-gray-200 p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit Entry' : 'New Entry'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

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
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            {editingId && <button type="button" onClick={() => handleDelete(editingId)} className="ml-auto flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No entries yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{format(new Date(entry.entry_date), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-gray-500">
                    {entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : ''}
                    {entry.driver_name ? ` · ${entry.driver_name}` : ''}
                    {entry.truck_number ? ` · ${entry.truck_number}` : ''}
                    {entry.actual_volume ? ` · ${Number(entry.actual_volume).toLocaleString()} vol` : ''}
                    {entry.users?.name ? ` · by ${entry.users.name}` : ''}
                  </p>
                </div>
                <button onClick={() => openEdit(entry)} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /> Edit</button>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
