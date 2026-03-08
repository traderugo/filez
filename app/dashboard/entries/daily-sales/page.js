'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function DailySalesPage() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [nozzleReadings, setNozzleReadings] = useState([])
  const [tankReadings, setTankReadings] = useState([])
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  const limit = 14
  const totalPages = Math.ceil(total / limit)

  const loadEntries = async (p = page) => {
    const res = await fetch(`/api/entries/daily-sales?page=${p}&limit=${limit}`)
    if (res.status === 403) { setLocked(true); setLoading(false); return }
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }

  const loadNozzles = async () => {
    try {
      const res = await fetch('/api/entries/nozzles')
      if (!res.ok) {
        console.error('Failed to load nozzles:', res.status, await res.text())
        return
      }
      const data = await res.json()
      setNozzles(data.nozzles || [])
    } catch (err) {
      console.error('Error loading nozzles:', err)
    }
  }

  const loadTanks = async () => {
    try {
      const res = await fetch('/api/entries/tanks')
      if (!res.ok) {
        console.error('Failed to load tanks:', res.status, await res.text())
        return
      }
      const data = await res.json()
      setTanks(data.tanks || [])
    } catch (err) {
      console.error('Error loading tanks:', err)
    }
  }

  useEffect(() => { loadEntries(); loadNozzles(); loadTanks() }, [])
  useEffect(() => { loadEntries(page) }, [page])

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormDate(new Date().toISOString().split('T')[0])
    setNozzleReadings([])
    setTankReadings([])
    setPrice('')
    setNotes('')
    setError('')
  }

  const openNew = () => {
    resetForm()
    setNozzleReadings(nozzles.map((n) => ({
      pump_id: n.id,
      label: `${n.fuel_type} ${n.pump_number}`,
      closing_meter: '',
      consumption: '',
      pour_back: '',
    })))
    setTankReadings(tanks.map((t) => ({
      tank_id: t.id,
      label: `${t.fuel_type} Tank ${t.tank_number}`,
      closing_stock: '',
    })))
    setShowForm(true)
  }

  const openEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date)
    setPrice(String(entry.price || ''))
    setNotes(entry.notes || '')
    // Merge saved nozzle readings with current nozzle config
    const savedNozzles = entry.nozzle_readings || []
    setNozzleReadings(nozzles.map((n) => {
      const match = savedNozzles.find((r) => r.pump_id === n.id)
      return {
        pump_id: n.id,
        label: `${n.fuel_type} ${n.pump_number}`,
        closing_meter: match ? String(match.closing_meter || '') : '',
        consumption: match ? String(match.consumption || '') : '',
        pour_back: match ? String(match.pour_back || '') : '',
      }
    }))
    // Merge saved tank readings with current tank config
    const savedTanks = entry.tank_readings || []
    setTankReadings(tanks.map((t) => {
      const match = savedTanks.find((r) => r.tank_id === t.id)
      return {
        tank_id: t.id,
        label: `${t.fuel_type} Tank ${t.tank_number}`,
        closing_stock: match ? String(match.closing_stock || '') : '',
      }
    }))
    setShowForm(true)
    setError('')
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

    if (!price || Number(price) <= 0) { setError('Price is required'); return }
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
      price: Number(price) || 0,
      notes,
    }

    if (editingId) body.id = editingId

    const res = await fetch('/api/entries/daily-sales', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      resetForm()
      loadEntries(page)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await fetch('/api/entries/daily-sales', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadEntries(page)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/dashboard/entries" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-block">&larr; All Entries</Link>
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Daily Sales Operations service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/entries" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-block">&larr; All Entries</Link>
          <h1 className="text-xl font-bold text-gray-900">Daily Sales</h1>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="border border-gray-200 p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit Entry' : 'New Entry'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            {editingId && <button type="button" onClick={() => handleDelete(editingId)} className="ml-auto flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
          </div>
        </form>
      )}

      {/* Entries list */}
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
                    {entry.price ? ` · ₦${Number(entry.price).toLocaleString()}` : ''}
                    {entry.users?.name ? ` · by ${entry.users.name}` : ''}
                  </p>
                </div>
                <button onClick={() => openEdit(entry)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /> Edit</button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
