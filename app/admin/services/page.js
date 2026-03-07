'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react'

export default function AdminServicesPage() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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

  const resetForm = () => {
    setName('')
    setDescription('')
    setPrice('')
    setError('')
    setShowAdd(false)
    setEditingId(null)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!price || Number(price) < 0) { setError('Valid price is required'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, price: Number(price) }),
    })

    if (res.ok) {
      resetForm()
      loadServices()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create')
    }
    setSaving(false)
  }

  const startEdit = (svc) => {
    setEditingId(svc.id)
    setName(svc.name)
    setDescription(svc.description || '')
    setPrice(String(svc.price))
    setError('')
    setShowAdd(false)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!price || Number(price) < 0) { setError('Valid price is required'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name, description, price: Number(price) }),
    })

    if (res.ok) {
      resetForm()
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

  const handleDelete = async (svc) => {
    if (!confirm(`Delete "${svc.name}"? This cannot be undone.`)) return
    await fetch('/api/services', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: svc.id }),
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Services</h1>
        <button
          onClick={() => { resetForm(); setShowAdd(true) }}
          className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add service
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Manage the services users can subscribe to. Only active services are shown on the subscribe page.
      </p>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="border border-gray-200 rounded-md p-4 mb-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Daily Sales Operation Report"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Brief description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (NGN)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Add service
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Service list */}
      {services.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No services yet. Add one to get started.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {services.map((svc) => (
            <div key={svc.id} className="py-3">
              {editingId === svc.id ? (
                <form onSubmit={handleUpdate} className="space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save
                    </button>
                    <button type="button" onClick={resetForm} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-3">
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
                  <button onClick={() => toggleActive(svc)} className="p-1.5 text-gray-400 hover:text-orange-600" title={svc.is_active ? 'Deactivate' : 'Activate'}>
                    {svc.is_active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => startEdit(svc)} className="p-1.5 text-gray-400 hover:text-gray-600" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(svc)} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
