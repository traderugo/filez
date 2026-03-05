'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Copy, Check, Pencil, X, Fuel, Link as LinkIcon } from 'lucide-react'

export default function AdminSettingsPage() {
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)

  // Add station
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // Edit station
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // Copy link
  const [copiedId, setCopiedId] = useState(null)

  const loadData = async () => {
    const res = await fetch('/api/organizations')
    const data = await res.json()
    setStations(data.stations || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const addStation = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })

    if (res.ok) {
      setNewName('')
      setShowAdd(false)
      loadData()
    }
    setAdding(false)
  }

  const updateStation = async (id) => {
    if (!editName.trim()) return
    setSaving(true)

    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName }),
    })

    if (res.ok) {
      setEditingId(null)
      loadData()
    }
    setSaving(false)
  }

  const deleteStation = async (id, name) => {
    if (!confirm(`Delete "${name}"? All staff accounts, subscriptions, and data for this station will be permanently removed.`)) return

    await fetch('/api/organizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadData()
  }

  const copyLink = (slug, id) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${slug}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
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
        <h1 className="text-xl font-bold text-gray-900">Stations</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add station
        </button>
      </div>

      {/* Add station form */}
      {showAdd && (
        <form onSubmit={addStation} className="border border-gray-200 rounded-md p-4 mb-6 space-y-3">
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Station name (e.g. MRS Lekki Phase 1)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Create station
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName('') }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Station list */}
      {stations.length === 0 ? (
        <div className="text-center py-12">
          <Fuel className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No stations yet</p>
          <p className="text-xs text-gray-400">Add your first fuel station to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stations.map((station) => (
            <div key={station.id} className="border border-gray-200 rounded-lg p-4">
              {/* Station name row */}
              <div className="flex items-center gap-3 mb-3">
                <Fuel className="w-5 h-5 text-orange-600 flex-shrink-0" />
                {editingId === station.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      autoFocus
                    />
                    <button onClick={() => updateStation(station.id)} disabled={saving} className="px-3 py-1.5 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{station.name}</span>
                    <button onClick={() => { setEditingId(station.id); setEditName(station.name) }} className="p-1 text-gray-400 hover:text-gray-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button onClick={() => deleteStation(station.id, station.name)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Invite link */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2">
                <LinkIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-xs text-gray-600 font-mono truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/join/${station.slug}` : `/join/${station.slug}`}
                </span>
                <button
                  onClick={() => copyLink(station.slug, station.id)}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                >
                  {copiedId === station.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === station.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
