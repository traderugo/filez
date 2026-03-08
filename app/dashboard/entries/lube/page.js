'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const SALES_API = '/api/entries/lube-sales'
const STOCK_API = '/api/entries/lube-stock'

export default function LubePage() {
  const [tab, setTab] = useState('sales')
  const [locked, setLocked] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [products, setProducts] = useState([])

  useEffect(() => {
    const check = async () => {
      const [accessRes, prodRes] = await Promise.all([
        fetch(`${SALES_API}?page=1&limit=1`),
        fetch('/api/entries/lube-products'),
      ])
      if (accessRes.status === 403) setLocked(true)
      if (prodRes.ok) {
        const prodData = await prodRes.json()
        setProducts(prodData.products || [])
      }
      setCheckingAccess(false)
    }
    check()
  }, [])

  if (checkingAccess) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">

      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Lube Management service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>

          <h1 className="text-xl font-bold text-gray-900">Lube</h1>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('sales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Lube Sales
        </button>
        <button
          onClick={() => setTab('stock')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Lube Stock
        </button>
      </div>

      {tab === 'sales' ? <LubeSalesTab products={products} /> : <LubeStockTab products={products} />}
    </div>
  )
}

/* -- Lube Sales Tab -- */
function LubeSalesTab({ products }) {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [productId, setProductId] = useState('')
  const [unitSold, setUnitSold] = useState('')
  const [unitReceived, setUnitReceived] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  const limit = 14
  const totalPages = Math.ceil(total / limit)

  const loadEntries = async (p = page) => {
    const res = await fetch(`${SALES_API}?page=${p}&limit=${limit}`)
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
    setProductId(''); setUnitSold(''); setUnitReceived(''); setPrice(''); setNotes('')
  }

  const openEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date || '')
    setProductId(entry.product_id || '')
    setUnitSold(String(entry.unit_sold ?? ''))
    setUnitReceived(String(entry.unit_received ?? ''))
    setPrice(String(entry.price ?? ''))
    setNotes(entry.notes || '')
    setShowForm(true); setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!productId) { setError('Product is required'); return }
    setSaving(true); setError('')

    const body = { entry_date: formDate, product_id: productId, unit_sold: Number(unitSold) || 0, unit_received: Number(unitReceived) || 0, price: Number(price) || 0, notes }
    if (editingId) body.id = editingId

    const res = await fetch(SALES_API, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { resetForm(); loadEntries(page) }
    else { const data = await res.json(); setError(data.error || 'Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await fetch(SALES_API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadEntries(page)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Sale
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="border border-gray-200 p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit Sale' : 'New Sale'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Entry Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit Sold</label>
              <input type="number" value={unitSold} onChange={(e) => setUnitSold(e.target.value)} step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit Received</label>
              <input type="number" value={unitReceived} onChange={(e) => setUnitReceived(e.target.value)} step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
        <p className="text-sm text-gray-500 py-8 text-center">No sales entries yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(entry.entry_date), 'MMM d, yyyy')}
                    <span className="ml-2 text-xs text-gray-600">{entry.product?.product_name || 'Unknown'}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : ''}
                    {' · '}Sold: {entry.unit_sold} · Received: {entry.unit_received} · &#8358;{Number(entry.price).toLocaleString()}
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
    </>
  )
}

/* -- Lube Stock Tab -- */
function LubeStockTab({ products }) {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [productId, setProductId] = useState('')
  const [stock, setStock] = useState('')
  const [notes, setNotes] = useState('')

  const limit = 14
  const totalPages = Math.ceil(total / limit)

  const loadEntries = async (p = page) => {
    const res = await fetch(`${STOCK_API}?page=${p}&limit=${limit}`)
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
    setProductId(''); setStock(''); setNotes('')
  }

  const openEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date || '')
    setProductId(entry.product_id || '')
    setStock(String(entry.stock ?? ''))
    setNotes(entry.notes || '')
    setShowForm(true); setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!productId) { setError('Product is required'); return }
    setSaving(true); setError('')

    const body = { entry_date: formDate, product_id: productId, stock: Number(stock) || 0, notes }
    if (editingId) body.id = editingId

    const res = await fetch(STOCK_API, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { resetForm(); loadEntries(page) }
    else { const data = await res.json(); setError(data.error || 'Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await fetch(STOCK_API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadEntries(page)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Stock Entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="border border-gray-200 p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit Stock Entry' : 'New Stock Entry'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Entry Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock</label>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
        <p className="text-sm text-gray-500 py-8 text-center">No stock entries yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(entry.entry_date), 'MMM d, yyyy')}
                    <span className="ml-2 text-xs text-gray-600">{entry.product?.product_name || 'Unknown'}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : ''}
                    {' · '}Stock: {Number(entry.stock).toLocaleString()}
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
    </>
  )
}
