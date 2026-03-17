'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Pencil, X, Fuel, Mail, UserPlus, FolderOpen } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

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

  // Invites
  const [invites, setInvites] = useState({}) // { stationId: [invite, ...] }
  const [inviteEmail, setInviteEmail] = useState({}) // { stationId: 'email' }
  const [inviting, setInviting] = useState(null)

  // Groups
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [groupError, setGroupError] = useState('')

  const loadData = async () => {
    const [stationsRes, groupsRes] = await Promise.all([
      fetch('/api/organizations'),
      fetch('/api/station-groups'),
    ])
    if (stationsRes.ok) {
      const data = await stationsRes.json()
      const stationList = data.stations || []
      setStations(stationList)

      // Load invites for all stations
      const allInvites = {}
      await Promise.all(stationList.map(async (s) => {
        const r = await fetch(`/api/invites/list?org_id=${s.id}`)
        if (r.ok) {
          const d = await r.json()
          allInvites[s.id] = d.invites || []
        }
      }))
      setInvites(allInvites)
    }
    if (groupsRes.ok) {
      const data = await groupsRes.json()
      setGroups(data.groups || [])
    }
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

  const addInvite = async (stationId) => {
    const email = inviteEmail[stationId]?.trim()
    if (!email) return
    setInviting(stationId)

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: stationId, email }),
    })

    if (res.ok) {
      setInviteEmail((prev) => ({ ...prev, [stationId]: '' }))
      // Reload invites for this station
      const r = await fetch(`/api/invites/list?org_id=${stationId}`)
      if (r.ok) {
        const d = await r.json()
        setInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
      }
    }
    setInviting(null)
  }

  const removeInvite = async (inviteId, stationId) => {
    await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inviteId }),
    })
    // Reload invites for this station
    const r = await fetch(`/api/invites/list?org_id=${stationId}`)
    if (r.ok) {
      const d = await r.json()
      setInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
    }
  }

  const addGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.trim()) return
    setAddingGroup(true)
    setGroupError('')
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
      setGroupError(data.error || 'Failed to add group')
    }
    setAddingGroup(false)
  }

  const removeGroup = async (id) => {
    if (!confirm('Delete this group? Stations in this group will be unassigned.')) return
    const deleted = groups.find((g) => g.id === id)
    const res = await fetch('/api/station-groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
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
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
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
                <button onClick={() => removeGroup(g.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete group">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {groups.length === 0 && <p className="text-sm text-gray-400 mb-4">No groups yet.</p>}

        <form onSubmit={addGroup} className="flex gap-2">
          <input
            type="text"
            placeholder="New group name"
            maxLength={100}
            value={newGroup}
            onChange={(e) => { setNewGroup(e.target.value); setGroupError('') }}
            className="flex-1 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={addingGroup || !newGroup.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {addingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>
        {groupError && <p className="text-sm text-red-600 mt-2">{groupError}</p>}
      </section>

      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add station
        </button>
      </div>

      {/* Add station form */}
      {showAdd && (
        <form onSubmit={addStation} className="border border-gray-200 p-4 mb-6 space-y-3">
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Station name (e.g. MRS Lekki Phase 1)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Create station
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName('') }} className="px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
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
          <p className="text-xs text-gray-400">Add your first station to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stations.map((station) => (
            <div key={station.id} className="border border-gray-200 p-4">
              {/* Station name row */}
              <div className="flex items-center gap-3 mb-3">
                <Fuel className="w-5 h-5 text-blue-600 flex-shrink-0" />
                {editingId === station.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      className="flex-1 px-3 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button onClick={() => updateStation(station.id)} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
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

              {/* Group assignment */}
              {groups.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-gray-500 shrink-0">Group:</label>
                  <div className="flex-1 border border-gray-200 bg-white">
                    <SearchableSelect
                      value={station.station_group || ''}
                      onChange={(val) => assignGroup(station.id, val)}
                      options={[{ value: '', label: 'None' }, ...groups.map((g) => ({ value: g.name, label: g.name }))]}
                      placeholder="None"
                    />
                  </div>
                </div>
              )}

              {/* Invite staff by email */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Invite Staff
                </p>
                <form
                  onSubmit={(e) => { e.preventDefault(); addInvite(station.id) }}
                  className="flex gap-2 mb-2"
                >
                  <div className="flex-1 relative">
                    <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="staff@email.com"
                      maxLength={254}
                      value={inviteEmail[station.id] || ''}
                      onChange={(e) => setInviteEmail((prev) => ({ ...prev, [station.id]: e.target.value }))}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inviting === station.id || !inviteEmail[station.id]?.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {inviting === station.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Invite
                  </button>
                </form>

                {/* Existing invites */}
                {(invites[station.id] || []).length > 0 && (
                  <div className="space-y-1">
                    {invites[station.id].map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between bg-gray-50 px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-700">{inv.email}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            inv.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            inv.status === 'declined' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                        <button
                          onClick={() => removeInvite(inv.id, station.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
