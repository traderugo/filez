'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const API = '/api/entries/lodgements'

export default function LodgementsPage() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [lodgementType, setLodgementType] = useState('deposit')
  const [salesDate, setSalesDate] = useState('')
  const [notes, setNotes] = useState('')

  const limit = 20
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

  useEffect(() => { loadEntries() }, [])
  useEffect(() => { loadEntries(page) }, [page])

  const resetForm = () => {
    setShowForm(false); setEditingId(null); setError('')
    setFormDate(new Date().toISOString().split('T')[0])
    setAmount(''); setBankName(''); setLodgementType('deposit'); setSalesDate(''); setNotes('')
  }

  const openEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date || '')
    setAmount(String(entry.amount ?? ''))
    setBankName(entry.bank_name || '')
    setLodgementType(entry.lodgement_type || 'deposit')
    setSalesDate(entry.sales_date || '')
    setNotes(entry.notes || '')
    setShowForm(true); setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!bankName.trim()) { setError('Bank name is required'); return }
    setSaving(true); setError('')

    const body = { entry_date: formDate, amount: Number(amount) || 0, bank_name: bankName, lodgement_type: lodgementType, sales_date: salesDate || null, notes }
    if (editingId) body.id = editingId

    const res = await fetch(API, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { resetForm(); loadEntries(page) }
    else { const data = await res.json(); setError(data.error || 'Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadEntries(page)
  }

  const typeLabel = { deposit: 'Deposit', 'lube-deposit': 'Lube Deposit', pos: 'POS' }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/dashboard/entries" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-block">&larr; All Entries</Link>
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Fuel Operations service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/entries" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-block">&larr; All Entries</Link>
          <h1 className="text-xl font-bold text-gray-900">Lodgements</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-1 text-sm bg-orange-600 text-white px-4 py-2 rounded-md font-medium hover:bg-orange-700">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded-md p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit Entry' : 'New Entry'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Entry Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={lodgementType} onChange={(e) => setLodgementType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="deposit">Deposit</option>
                <option value="lube-deposit">Lube Deposit</option>
                <option value="pos">POS</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sales Date</label>
            <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
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
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(entry.entry_date), 'MMM d, yyyy')}
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{typeLabel[entry.lodgement_type] || entry.lodgement_type}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    ₦{Number(entry.amount).toLocaleString()} · {entry.bank_name}
                    {entry.users?.name ? ` · by ${entry.users.name}` : ''}
                  </p>
                </div>
                <button onClick={() => openEdit(entry)} className="p-1.5 text-gray-400 hover:text-gray-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
