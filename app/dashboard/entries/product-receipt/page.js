'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, List, Trash2, Lock } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { productReceiptsRepo } from '@/lib/repositories/productReceipts'
import { initialSync } from '@/lib/initialSync'
import { startSync } from '@/lib/sync'

export default function ProductReceiptFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [tanks, setTanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    loadedDate: '', driverName: '', waybillNumber: '', ticketNumber: '', truckNumber: '',
    chartUllage: '', chartLiquidHeight: '', depotUllage: '', depotLiquidHeight: '',
    stationUllage: '', stationLiquidHeight: '',
    firstCompartment: '', secondCompartment: '', thirdCompartment: '',
    actualVolume: '', depotName: '', tankId: '', notes: '',
  })

  const sf = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }
      try { await initialSync(orgId) } catch (e) { /* offline */ }
      try { startSync() } catch (e) { /* offline */ }

      if (cancelled) return

      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()
      if (tnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setTanks(tnk)

      if (editId) {
        const entry = await productReceiptsRepo.getById(editId)
        if (entry && !cancelled) {
          setForm({
            entryDate: entry.entryDate || '',
            loadedDate: entry.loadedDate || '',
            driverName: entry.driverName || '',
            waybillNumber: entry.waybillNumber || '',
            ticketNumber: entry.ticketNumber || '',
            truckNumber: entry.truckNumber || '',
            chartUllage: entry.chartUllage ?? '',
            chartLiquidHeight: entry.chartLiquidHeight ?? '',
            depotUllage: entry.depotUllage ?? '',
            depotLiquidHeight: entry.depotLiquidHeight ?? '',
            stationUllage: entry.stationUllage ?? '',
            stationLiquidHeight: entry.stationLiquidHeight ?? '',
            firstCompartment: entry.firstCompartment ?? '',
            secondCompartment: entry.secondCompartment ?? '',
            thirdCompartment: entry.thirdCompartment ?? '',
            actualVolume: entry.actualVolume ?? '',
            depotName: entry.depotName || '',
            tankId: entry.tankId || '',
            notes: entry.notes || '',
          })
        }
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [editId, orgId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.entryDate) { setError('Date is required'); return }
    setSaving(true)
    setError('')

    const record = {
      id: editId || crypto.randomUUID(),
      orgId,
      entryDate: form.entryDate,
      loadedDate: form.loadedDate || null,
      driverName: form.driverName,
      waybillNumber: form.waybillNumber,
      ticketNumber: form.ticketNumber,
      truckNumber: form.truckNumber,
      chartUllage: Number(form.chartUllage) || 0,
      chartLiquidHeight: Number(form.chartLiquidHeight) || 0,
      depotUllage: Number(form.depotUllage) || 0,
      depotLiquidHeight: Number(form.depotLiquidHeight) || 0,
      stationUllage: Number(form.stationUllage) || 0,
      stationLiquidHeight: Number(form.stationLiquidHeight) || 0,
      firstCompartment: Number(form.firstCompartment) || 0,
      secondCompartment: Number(form.secondCompartment) || 0,
      thirdCompartment: Number(form.thirdCompartment) || 0,
      actualVolume: Number(form.actualVolume) || 0,
      depotName: form.depotName,
      tankId: form.tankId || null,
      notes: form.notes,
      createdAt: editId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editId) {
        const existing = await productReceiptsRepo.getById(editId)
        await productReceiptsRepo.update({ ...existing, ...record })
      } else {
        await productReceiptsRepo.create(record)
      }
      router.push(`/dashboard/entries/product-receipt/list?${qs}`)
    } catch (err) {
      setError('Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId || !confirm('Delete this entry?')) return
    await productReceiptsRepo.remove(editId, orgId)
    router.push(`/dashboard/entries/product-receipt/list?${qs}`)
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
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Edit Entry' : 'New Product Receipt'}</h1>
        <Link href={`/dashboard/entries/product-receipt/list?${qs}`} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50">
          <List className="w-4 h-4" /> View Entries
        </Link>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
        <div className="border border-gray-300 divide-y divide-gray-300">
          <div className="grid grid-cols-2 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Entry Date</label>
              <input type="date" value={form.entryDate} onChange={sf('entryDate')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Loaded Date</label>
              <input type="date" value={form.loadedDate} onChange={sf('loadedDate')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Driver Name</label>
              <input type="text" value={form.driverName} onChange={sf('driverName')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Waybill No.</label>
              <input type="text" value={form.waybillNumber} onChange={sf('waybillNumber')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Ticket No.</label>
              <input type="text" value={form.ticketNumber} onChange={sf('ticketNumber')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Truck Number</label>
              <input type="text" value={form.truckNumber} onChange={sf('truckNumber')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Depot Name</label>
              <input type="text" value={form.depotName} onChange={sf('depotName')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="bg-gray-50 px-2 py-1">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Chart / Depot / Station</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Chart Ullage</label>
              <input type="number" value={form.chartUllage} onChange={sf('chartUllage')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Chart Liq. Height</label>
              <input type="number" value={form.chartLiquidHeight} onChange={sf('chartLiquidHeight')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Depot Ullage</label>
              <input type="number" value={form.depotUllage} onChange={sf('depotUllage')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Depot Liq. Height</label>
              <input type="number" value={form.depotLiquidHeight} onChange={sf('depotLiquidHeight')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Station Ullage</label>
              <input type="number" value={form.stationUllage} onChange={sf('stationUllage')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Station Liq. Height</label>
              <input type="number" value={form.stationLiquidHeight} onChange={sf('stationLiquidHeight')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="bg-gray-50 px-2 py-1">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Compartments</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">1st Compartment</label>
              <input type="number" value={form.firstCompartment} onChange={sf('firstCompartment')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">2nd Compartment</label>
              <input type="number" value={form.secondCompartment} onChange={sf('secondCompartment')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">3rd Compartment</label>
              <input type="number" value={form.thirdCompartment} onChange={sf('thirdCompartment')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-300">
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Actual Volume</label>
              <input type="number" value={form.actualVolume} onChange={sf('actualVolume')} step="0.01" min="0" className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Receiving Tank</label>
              <select value={form.tankId} onChange={sf('tankId')} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50">
                <option value="">Select tank</option>
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>Tank {t.tank_number} ({t.fuel_type})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 px-2 pt-1 uppercase tracking-wide">Notes</label>
            <textarea value={form.notes} onChange={sf('notes')} rows={2} maxLength={500} className="w-full px-3 py-2.5 text-base bg-transparent focus:outline-none focus:bg-blue-50 resize-none" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-3">
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
