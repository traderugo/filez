'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'

export default function LodgementsFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const qs = `org_id=${orgId}`
  const API = '/api/entries/lodgements'

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [banks, setBanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [bankId, setBankId] = useState('')
  const [lodgementType, setLodgementType] = useState('deposit')
  const [salesDate, setSalesDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const bankRes = await fetch(`/api/entries/banks?${qs}`)
      if (bankRes.status === 403) { setLocked(true); setLoading(false); return }
      if (bankRes.ok) {
        const bankData = await bankRes.json()
        if (!cancelled) setBanks(bankData.banks || [])
      }

      if (editId) {
        const res = await fetch(`${API}?id=${editId}&${qs}`)
        if (res.ok) {
          const data = await res.json()
          if (data.entry && !cancelled) {
            setFormDate(data.entry.entry_date || '')
            setAmount(String(data.entry.amount ?? ''))
            setBankId(data.entry.bank_id || '')
            setLodgementType(data.entry.lodgement_type || 'deposit')
            setSalesDate(data.entry.sales_date || '')
            setNotes(data.entry.notes || '')
          }
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
    if (!bankId) { setError('Bank account is required'); return }
    setSaving(true)
    setError('')

    const body = { entry_date: formDate, amount: Number(amount) || 0, bank_id: bankId, lodgement_type: lodgementType, sales_date: salesDate || null, notes }
    if (editId) body.id = editId

    const res = await fetch(`${API}?${qs}`, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push(`/dashboard/entries/lodgements/list?${qs}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await fetch(`${API}?${qs}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId }) })
    router.push(`/dashboard/entries/lodgements/list?${qs}`)
  }

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
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Edit Entry' : 'New Lodgement'}</h1>
        <Link href={`/dashboard/entries/lodgements/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const inputs = Array.from(e.currentTarget.querySelectorAll('input, select')); const idx = inputs.indexOf(e.target); if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus() } }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Entry Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bank Account</label>
            <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select account</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.bank_name} ({b.lodgement_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select value={lodgementType} onChange={(e) => setLodgementType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="deposit">Deposit</option>
              <option value="lube-deposit">Lube Deposit</option>
              <option value="pos">POS</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sales Date</label>
          <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          {editId && <button type="button" onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /> Delete</button>}
          <Link href={`/dashboard/entries/lodgements/list?${qs}`} className="ml-auto px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
