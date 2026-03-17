'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, X, Pencil, ToggleLeft, ToggleRight, Fuel, Droplets, Users } from 'lucide-react'

const SERVICE_ICONS = {
  'fuel-operations': Fuel,
  'lube-management': Droplets,
  'customer-payments': Users,
}

export default function AdminServicesPage() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [price, setPrice] = useState('')

  const loadServices = async () => {
    const res = await fetch('/api/services')
    if (res.ok) {
      const data = await res.json()
      setServices(data.services || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadServices() }, [])

  const startEdit = (svc) => {
    setEditingId(svc.id)
    setPrice(String(svc.price))
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setPrice('')
    setError('')
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!price || Number(price) < 0) { setError('Valid price is required'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, price: Number(price) }),
    })

    if (res.ok) {
      cancelEdit()
      loadServices()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to update')
    }
    setSaving(false)
  }

  const toggleActive = async (svc) => {
    await fetch('/api/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: svc.id, is_active: !svc.is_active }),
    })
    loadServices()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-6">
        Set subscription prices for each service. Only active services are shown on the subscribe page.
      </p>

      {services.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No services found. Run migration 017 to seed them.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {services.map((svc) => {
            const Icon = SERVICE_ICONS[svc.key] || Fuel
            return (
              <div key={svc.id} className="py-4">
                {editingId === svc.id ? (
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-blue-600" />
                      <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Price (NGN)</label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </button>
                      <button type="button" onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                        {!svc.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Inactive</span>
                        )}
                      </div>
                      {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {Number(svc.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                    </span>
                    <button onClick={() => toggleActive(svc)} className="p-1.5 text-gray-400 hover:text-blue-600" title={svc.is_active ? 'Deactivate' : 'Activate'}>
                      {svc.is_active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => startEdit(svc)} className="p-1.5 text-gray-400 hover:text-gray-600" title="Edit price">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
