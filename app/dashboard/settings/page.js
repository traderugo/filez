'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2, Plus, Trash2, Fuel, ChevronRight, Settings, FolderOpen, ShieldAlert
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [groups, setGroups] = useState([])
  const [stations, setStations] = useState([])
  const [newGroup, setNewGroup] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      // Check admin role first
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) { router.push('/auth/login'); return }
      const me = await meRes.json()
      if (me.role !== 'admin') { setForbidden(true); setLoading(false); return }

      const [groupsRes, stationsRes] = await Promise.all([
        fetch('/api/station-groups'),
        fetch('/api/organizations'),
      ])
      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data.groups || [])
      }
      if (stationsRes.ok) {
        const data = await stationsRes.json()
        setStations(data.stations || [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  const addGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/station-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroup }),
    })
    if (res.ok) {
      const data = await res.json()
      setGroups((prev) => [...prev, data.group].sort((a, b) => a.name.localeCompare(b.name)))
      setNewGroup('')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to add group')
    }
    setAdding(false)
  }

  const removeGroup = async (id) => {
    if (!confirm('Delete this group? Stations in this group will be unassigned.')) return
    const res = await fetch('/api/station-groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      const deleted = groups.find((g) => g.id === id)
      setGroups((prev) => prev.filter((g) => g.id !== id))
      if (deleted) {
        setStations((prev) => prev.map((s) =>
          s.station_group === deleted.name ? { ...s, station_group: null } : s
        ))
      }
    }
  }

  const assignGroup = async (stationId, groupName) => {
    setStations((prev) => prev.map((s) =>
      s.id === stationId ? { ...s, station_group: groupName || null } : s
    ))
    await fetch('/api/station-groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: stationId, group_name: groupName || null }),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="max-w-lg px-4 sm:px-8 py-8 text-center">
        <ShieldAlert className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Access Denied</h2>
        <p className="text-sm text-gray-500">This page is only available to admins.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg px-4 sm:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Station Groups */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-600" /> Station Groups
        </h2>

        {groups.length > 0 && (
          <div className="divide-y divide-gray-200 border border-gray-200 mb-4">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-gray-900">{g.name}</span>
                <button
                  onClick={() => removeGroup(g.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete group"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {groups.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">No groups yet.</p>
        )}

        <form onSubmit={addGroup} className="flex gap-2">
          <input
            type="text"
            placeholder="New group name"
            maxLength={100}
            value={newGroup}
            onChange={(e) => { setNewGroup(e.target.value); setError('') }}
            className="flex-1 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={adding || !newGroup.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </section>

      {/* Stations */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-blue-600" /> Stations
        </h2>

        {stations.length === 0 ? (
          <p className="text-sm text-gray-400">No stations yet.</p>
        ) : (
          <div className="space-y-2">
            {stations.map((station) => (
              <div key={station.id} className="border border-gray-200">
                <div className="flex items-center gap-3 p-3">
                  <Fuel className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{station.name}</p>
                    {station.location && <p className="text-xs text-gray-500 truncate">{station.location}</p>}
                  </div>
                  <Link
                    href={`/dashboard/stations/${station.id}`}
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                    title="Open station"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
                  <label className="text-xs text-gray-500 shrink-0">Group:</label>
                  <select
                    value={station.station_group || ''}
                    onChange={(e) => assignGroup(station.id, e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">None</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
