'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'

const SALES_API = '/api/entries/lube-sales'
const STOCK_API = '/api/entries/lube-stock'

export default function LubeFormPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editType = searchParams.get('type') || 'sales'
  const qs = `org_id=${orgId}`

  const [tab, setTab] = useState(editType)
  const [locked, setLocked] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [products, setProducts] = useState([])

  useEffect(() => {
    const check = async () => {
      const [accessRes, prodRes] = await Promise.all([
        fetch(`${SALES_API}?page=1&limit=1&${qs}`),
        fetch(`/api/entries/lube-products?${qs}`),
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
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Edit Entry' : 'New Lube Entry'}</h1>
        <Link href={`/dashboard/entries/lube/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      {!editId && (
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setTab('sales')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Lube Sales
          </button>
          <button onClick={() => setTab('stock')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Lube Stock
          </button>
        </div>
      )}

      {tab === 'sales' ? <LubeSalesForm products={products} qs={qs} editId={editId} /> : <LubeStockForm products={products} qs={qs} editId={editId} />}
    </div>
  )
}

function LubeSalesForm({ products, qs, editId }) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [productId, setProductId] = useState('')
  const [unitSold, setUnitSold] = useState('')
  const [unitReceived, setUnitReceived] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    const load = async () => {
      const res = await fetch(`${SALES_API}?id=${editId}&${qs}`)
      if (res.ok) {
        const data = await res.json()
        if (data.entry && !cancelled) {
          setFormDate(data.entry.entry_date || '')
          setProductId(data.entry.product_id || '')
          setUnitSold(String(data.entry.unit_sold ?? ''))
          setUnitReceived(String(data.entry.unit_received ?? ''))
          setPrice(String(data.entry.price ?? ''))
          setNotes(data.entry.notes || '')
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [editId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!productId) { setError('Product is required'); return }
    setSaving(true)
    setError('')

    const body = { entry_date: formDate, product_id: productId, unit_sold: Number(unitSold) || 0, unit_received: Number(unitReceived) || 0, price: Number(price) || 0, notes }
    if (editId) body.id = editId

    const res = await fetch(`${SALES_API}?${qs}`, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      router.push(`/dashboard/entries/lube/list?${qs}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await fetch(`${SALES_API}?${qs}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId }) })
    router.push(`/dashboard/entries/lube/list?${qs}`)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="space-y-4">
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
        {editId && <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
        <Link href={`/dashboard/entries/lube/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editId ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function LubeStockForm({ products, qs, editId }) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [productId, setProductId] = useState('')
  const [stock, setStock] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    const load = async () => {
      const res = await fetch(`${STOCK_API}?id=${editId}&${qs}`)
      if (res.ok) {
        const data = await res.json()
        if (data.entry && !cancelled) {
          setFormDate(data.entry.entry_date || '')
          setProductId(data.entry.product_id || '')
          setStock(String(data.entry.stock ?? ''))
          setNotes(data.entry.notes || '')
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [editId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!productId) { setError('Product is required'); return }
    setSaving(true)
    setError('')

    const body = { entry_date: formDate, product_id: productId, stock: Number(stock) || 0, notes }
    if (editId) body.id = editId

    const res = await fetch(`${STOCK_API}?${qs}`, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      router.push(`/dashboard/entries/lube/list?${qs}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await fetch(`${STOCK_API}?${qs}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId }) })
    router.push(`/dashboard/entries/lube/list?${qs}`)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="space-y-4">
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
        {editId && <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
        <Link href={`/dashboard/entries/lube/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editId ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
