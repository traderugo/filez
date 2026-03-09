'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { lubeSalesRepo } from '@/lib/repositories/lubeSales'
import { lubeStockRepo } from '@/lib/repositories/lubeStock'
import { initialSync } from '@/lib/initialSync'
import { startSync } from '@/lib/sync'

export default function LubeFormPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editType = searchParams.get('type') || 'sales'
  const qs = `org_id=${orgId}`

  const [tab, setTab] = useState(editType)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const load = async () => {
      await initialSync(orgId)
      startSync()
      const prods = await db.lubeProducts.where('orgId').equals(orgId).toArray()
      if (prods.length === 0) setLocked(true)
      setProducts(prods)
      setLoading(false)
    }
    load()
  }, [orgId])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

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

      {tab === 'sales' ? <LubeSalesForm products={products} qs={qs} orgId={orgId} editId={editId} /> : <LubeStockForm products={products} qs={qs} orgId={orgId} editId={editId} />}
    </div>
  )
}

function LubeSalesForm({ products, qs, orgId, editId }) {
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
    const load = async () => {
      const entry = await lubeSalesRepo.getById(editId)
      if (entry) {
        setFormDate(entry.entryDate || '')
        setProductId(entry.productId || '')
        setUnitSold(String(entry.unitSold ?? ''))
        setUnitReceived(String(entry.unitReceived ?? ''))
        setPrice(String(entry.price ?? ''))
        setNotes(entry.notes || '')
      }
      setLoading(false)
    }
    load()
  }, [editId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!productId) { setError('Product is required'); return }
    setSaving(true)
    setError('')

    const record = {
      id: editId || crypto.randomUUID(),
      orgId,
      entryDate: formDate,
      productId,
      unitSold: Number(unitSold) || 0,
      unitReceived: Number(unitReceived) || 0,
      price: Number(price) || 0,
      notes,
      createdAt: editId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editId) {
        const existing = await lubeSalesRepo.getById(editId)
        await lubeSalesRepo.update({ ...existing, ...record })
      } else {
        await lubeSalesRepo.create(record)
      }
      router.push(`/dashboard/entries/lube/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await lubeSalesRepo.remove(editId, orgId)
    router.push(`/dashboard/entries/lube/list?${qs}`)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
      <div className="border border-gray-300 divide-y divide-gray-300">
        <div className="grid grid-cols-2 divide-x divide-gray-300">
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50">
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.product_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-300">
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Unit Sold</label>
            <input type="number" value={unitSold} onChange={(e) => setUnitSold(e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Unit Received</label>
            <input type="number" value={unitReceived} onChange={(e) => setUnitReceived(e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Price</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
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

function LubeStockForm({ products, qs, orgId, editId }) {
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
    const load = async () => {
      const entry = await lubeStockRepo.getById(editId)
      if (entry) {
        setFormDate(entry.entryDate || '')
        setProductId(entry.productId || '')
        setStock(String(entry.stock ?? ''))
        setNotes(entry.notes || '')
      }
      setLoading(false)
    }
    load()
  }, [editId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!productId) { setError('Product is required'); return }
    setSaving(true)
    setError('')

    const record = {
      id: editId || crypto.randomUUID(),
      orgId,
      entryDate: formDate,
      productId,
      stock: Number(stock) || 0,
      notes,
      createdAt: editId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editId) {
        const existing = await lubeStockRepo.getById(editId)
        await lubeStockRepo.update({ ...existing, ...record })
      } else {
        await lubeStockRepo.create(record)
      }
      router.push(`/dashboard/entries/lube/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await lubeStockRepo.remove(editId, orgId)
    router.push(`/dashboard/entries/lube/list?${qs}`)
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
      <div className="border border-gray-300 divide-y divide-gray-300">
        <div className="grid grid-cols-2 divide-x divide-gray-300">
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50">
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.product_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Stock</label>
          <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} step="0.01" min="0" className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
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
