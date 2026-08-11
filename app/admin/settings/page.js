'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Pencil, X, Fuel, Mail, UserPlus, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import SearchableSelect from '@/components/SearchableSelect'
import { OUTLINE } from '@/components/ui'

// The design system has no solid fills; weight comes from how hard the outline is drawn.
const SOLID_ACTION = 'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30'

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

  // Busy guard for async actions (prevents double-click)
  const [busyAction, setBusyAction] = useState(null)

  // Groups
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [groupError, setGroupError] = useState('')

  const loadData = async () => {
    const [stationsRes, groupsRes] = await Promise.all([
      // Every station on the platform, not just the admin's own — this screen exists to
      // manage everyone's.
      fetch('/api/admin/stations'),
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
    if (busyAction) return
    if (!confirm(`Delete "${name}"? All staff accounts, subscriptions, and data for this station will be permanently removed.`)) return

    setBusyAction(`del-station-${id}`)
    try {
      await fetch('/api/organizations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadData()
    } finally {
      setBusyAction(null)
    }
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
    if (busyAction) return
    setBusyAction(`rm-invite-${inviteId}`)
    try {
      await fetch('/api/invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId }),
      })
      const r = await fetch(`/api/invites/list?org_id=${stationId}`)
      if (r.ok) {
        const d = await r.json()
        setInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
      }
    } finally {
      setBusyAction(null)
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
    if (busyAction) return
    if (!confirm('Delete this group? Stations in this group will be unassigned.')) return
    setBusyAction(`rm-group-${id}`)
    try {
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
    } finally {
      setBusyAction(null)
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
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Station Groups */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary-600" /> Station Groups
        </h2>

        {groups.length > 0 && (
          <div className="divide-y divide-line border border-line mb-4">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-content">{g.name}</span>
                <button onClick={() => removeGroup(g.id)} disabled={busyAction === `rm-group-${g.id}`} className="p-1 text-content-faint hover:text-red-600 dark:text-red-400 disabled:opacity-50" title="Delete group">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {groups.length === 0 && <p className="text-sm text-content-faint mb-4">No groups yet.</p>}

        <form onSubmit={addGroup} className="flex gap-2">
          <input
            type="text"
            placeholder="New group name"
            maxLength={100}
            value={newGroup}
            onChange={(e) => { setNewGroup(e.target.value); setGroupError('') }}
            className="flex-1 px-3 py-2 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={addingGroup || !newGroup.trim()}
            className={`flex items-center gap-1 px-3 py-2 text-sm font-medium disabled:opacity-50 ${SOLID_ACTION}`}
          >
            {addingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>
        {groupError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{groupError}</p>}
      </section>

      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add station
        </button>
      </div>

      {/* Add station form */}
      {showAdd && (
        <form onSubmit={addStation} className="border border-line p-4 mb-6 space-y-3">
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Station name (e.g. MRS Lekki Phase 1)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${SOLID_ACTION}`}
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Create station
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName('') }} className="px-4 py-2 border border-line text-sm text-content-strong hover:bg-subtle">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Station list */}
      {stations.length === 0 ? (
        <div className="text-center py-12">
          <Fuel className="w-10 h-10 text-content-faint mx-auto mb-3" />
          <p className="text-sm text-content-muted mb-1">No stations yet</p>
          <p className="text-xs text-content-faint">Add your first station to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stations.map((station) => (
            <div key={station.id} className="border border-line p-4">
              {/* Station name row */}
              <div className="flex items-center gap-3 mb-3">
                <Fuel className="w-5 h-5 text-primary-600 flex-shrink-0" />
                {editingId === station.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      className="flex-1 px-3 py-1.5 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <button onClick={() => updateStation(station.id)} disabled={saving} className={`px-3 py-1.5 text-sm disabled:opacity-50 ${SOLID_ACTION}`}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-content-faint hover:text-content-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-content truncate">{station.name}</span>
                    {/* Whose station this is. Without it the list is a wall of names with no
                        way to tell your own from an owner you are onboarding. */}
                    {station.owner_name && (
                      <span className="text-xs text-content-faint truncate">{station.owner_name}</span>
                    )}
                    {station.is_mine !== false && (
                      <button onClick={() => { setEditingId(station.id); setEditName(station.name) }} className="p-1 text-content-faint hover:text-content-muted">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* The way in. An admin could reach a station's setup only by typing its id
                    into the URL; the onboarding permission is useless without a door. */}
                <Link
                  href={station.onboarding_complete
                    ? `/dashboard/stations/${station.id}`
                    : `/dashboard/setup/${station.id}`}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
                >
                  {station.onboarding_complete ? 'Open' : 'Run setup'}
                </Link>
                {/* Delete goes through the owner-gated tenant route, so on someone else's
                    station it would silently do nothing. A button that appears to work and
                    does not is worse than no button — and admin-wide station deletion is
                    not something to open up by accident. */}
                {station.is_mine !== false && (
                  <button onClick={() => deleteStation(station.id, station.name)} disabled={busyAction === `del-station-${station.id}`} className="p-1.5 text-content-faint hover:text-red-600 dark:text-red-400 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Group assignment */}
              {groups.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-content-muted shrink-0">Group:</label>
                  <div className="flex-1 border border-line bg-surface">
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
                <p className="text-xs font-medium text-content-strong mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Invite Staff
                </p>
                <form
                  onSubmit={(e) => { e.preventDefault(); addInvite(station.id) }}
                  className="flex gap-2 mb-2"
                >
                  <div className="flex-1 relative">
                    <Mail className="w-3.5 h-3.5 text-content-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="staff@email.com"
                      maxLength={254}
                      value={inviteEmail[station.id] || ''}
                      onChange={(e) => setInviteEmail((prev) => ({ ...prev, [station.id]: e.target.value }))}
                      className="w-full pl-8 pr-3 py-1.5 border border-line text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inviting === station.id || !inviteEmail[station.id]?.trim()}
                    className={`px-3 py-1.5 text-sm disabled:opacity-50 flex items-center gap-1 ${SOLID_ACTION}`}
                  >
                    {inviting === station.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Invite
                  </button>
                </form>

                {/* Existing invites */}
                {(invites[station.id] || []).length > 0 && (
                  <div className="space-y-1">
                    {invites[station.id].map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between bg-subtle px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-content-faint" />
                          <span className="text-xs text-content-strong">{inv.email}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            inv.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            inv.status === 'declined' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                        <button
                          onClick={() => removeInvite(inv.id, station.id)}
                          disabled={busyAction === `rm-invite-${inv.id}`}
                          className="p-1 text-content-faint hover:text-red-600 dark:text-red-400 disabled:opacity-50"
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
