'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const API = '/api/entries/customer-payments'

export default function CustomerPaymentsPage() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [customers, setCustomers] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [customerId, setCustomerId] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [salesAmount, setSalesAmount] = useState('')
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

  useEffect(() => {
    const init = async () => {
      const custRes = await fetch('/api/entries/customers')
      if (custRes.ok) {
        const custData = await custRes.json()
        setCustomers(custData.customers || [])
      }
      loadEntries()
    }
    init()
  }, [])
  useEffect(() => { loadEntries(page) }, [page])

  const resetForm = () => {
    setShowForm(false); setEditingId(null); setError('')
    setFormDate(new Date().toISOString().split('T')[0])
    setCustomerId(''); setAmountPaid(''); setSalesAmount(''); setNotes('')
  }

  const openEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date || '')
    setCustomerId(entry.customer_id || '')
    setAmountPaid(String(entry.amount_paid ?? ''))
    setSalesAmount(String(entry.sales_amount ?? ''))
    setNotes(entry.notes || '')
    setShowForm(true); setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!customerId) { setError('Customer is required'); return }
    setSaving(true); setError('')

    const body = { entry_date: formDate, customer_id: customerId, amount_paid: Number(amountPaid) || 0, sales_amount: Number(salesAmount) || 0, notes }
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/dashboard/entries" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-block">&larr; All Entries</Link>
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Customer Payments service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/entries" className="text-xs text-gray-500 hover:text-gray-700 mb-1 inline-block">&larr; All Entries</Link>
          <h1 className="text-xl font-bold text-gray-900">Customer Payments</h1>
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">Transaction Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount Paid</label>
              <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sales Amount</label>
              <input type="number" value={salesAmount} onChange={(e) => setSalesAmount(e.target.value)} step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
                  <p className="text-sm font-medium text-gray-900">
                    {entry.customer?.name || 'Unknown'}
                    <span className="ml-2 text-xs text-gray-400">{format(new Date(entry.entry_date), 'MMM d, yyyy')}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : ''}
                    {' · '}Paid: &#8358;{Number(entry.amount_paid).toLocaleString()} · Sales: &#8358;{Number(entry.sales_amount).toLocaleString()}
                    {entry.users?.name ? ` · by ${entry.users.name}` : ''}
                  </p>
                </div>
                <button onClick={() => openEdit(entry)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /> Edit</button>
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
