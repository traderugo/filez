'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { lodgementsRepo } from '@/lib/repositories/lodgements'
import { initialSync } from '@/lib/initialSync'
import { startSync } from '@/lib/sync'

export default function LodgementsFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const qs = `org_id=${orgId}`

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
      if (!orgId) { setLoading(false); return }
      try { await initialSync(orgId) } catch (e) { /* offline */ }
      try { startSync() } catch (e) { /* offline */ }

      if (cancelled) return

      const bnk = await db.banks.where('orgId').equals(orgId).toArray()
      if (bnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      setBanks(bnk)

      if (editId) {
        const entry = await lodgementsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setAmount(String(entry.amount ?? ''))
          setBankId(entry.bankId || '')
          setLodgementType(entry.lodgementType || 'deposit')
          setSalesDate(entry.salesDate || '')
          setNotes(entry.notes || '')
        }
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [editId, orgId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formDate) { setError('Date is required'); return }
    if (!bankId) { setError('Bank account is required'); return }
    setSaving(true)
    setError('')

    const record = {
      id: editId || crypto.randomUUID(),
      orgId,
      entryDate: formDate,
      amount: Number(amount) || 0,
      bankId,
      lodgementType,
      salesDate: salesDate || null,
      notes,
      createdAt: editId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editId) {
        const existing = await lodgementsRepo.getById(editId)
        await lodgementsRepo.update({ ...existing, ...record })
      } else {
        await lodgementsRepo.create(record)
      }
      router.push(`/dashboard/entries/lodgements/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await lodgementsRepo.remove(editId, orgId)
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

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
        <div className="border border-gray-300 divide-y divide-gray-300">
          <div className="grid grid-cols-2 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Bank Account</label>
              <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50">
                <option value="">Select account</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.bank_name} ({b.lodgement_type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Type</label>
              <select value={lodgementType} onChange={(e) => setLodgementType(e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50">
                <option value="deposit">Deposit</option>
                <option value="lube-deposit">Lube Deposit</option>
                <option value="pos">POS</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Sales Date</label>
            <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
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
