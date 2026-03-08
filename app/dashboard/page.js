'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageSquare, Loader2,
  Building2, Check, Plus,
  Fuel, ChevronRight
} from 'lucide-react'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Invites (staff)
  const [invites, setInvites] = useState([])
  const [accepting, setAccepting] = useState(null)
  const [visiblePages, setVisiblePages] = useState(null)

  // Stations (manager + member)
  const [stations, setStations] = useState([])
  const [memberStations, setMemberStations] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const loadInvites = async () => {
    const res = await fetch('/api/invites')
    if (res.ok) {
      const data = await res.json()
      setInvites(data.invites || [])
      if (data.visiblePages) setVisiblePages(data.visiblePages)
    }
  }

  const loadStations = async () => {
    const res = await fetch('/api/organizations')
    if (res.ok) {
      const data = await res.json()
      setStations(data.stations || [])
      setMemberStations(data.memberStations || [])
    }
  }

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setLoading(false)
      loadInvites()
      loadStations()
    }
    load()
  }, [])

  // Staff actions
  const acceptInvite = async (inviteId) => {
    setAccepting(inviteId)
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId }),
    })
    if (res.ok) {
      const r = await fetch('/api/dashboard/data')
      if (r.ok) { const d = await r.json(); setProfile(d.profile) }
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to accept invite')
    }
    setAccepting(null)
  }

  // Manager actions
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
      loadStations()
    }
    setAdding(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl px-4 sm:px-8 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome, {profile?.name}</h1>
      <p className="text-sm text-gray-500 mb-8">{profile?.email}</p>

      {/* Pending station invites (staff) */}
      {invites.length > 0 && (
        <div className="mb-8 space-y-3">
          {invites.map((inv) => (
            <div key={inv.id} className="border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    You&apos;ve been invited to join <strong>{inv.organizations?.name}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Accept to access this station&apos;s reports and data.
                  </p>
                  <button
                    onClick={() => acceptInvite(inv.id)}
                    disabled={accepting === inv.id}
                    className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {accepting === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Stations */}
      <div className="border-t border-gray-200 pt-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">My Stations</h2>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add station
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addStation} className="border border-gray-200 p-4 mb-4 space-y-3">
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

        {stations.length === 0 && !showAdd ? (
          <div className="text-center py-8">
            <Fuel className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No stations yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stations.map((station) => (
              <div key={station.id} className="border border-gray-200">
                <div className="flex items-center gap-3 p-4">
                  <Fuel className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-base font-semibold text-gray-900">{station.name}</span>
                    {station.location && <p className="text-xs text-gray-500">{station.location}</p>}
                    {!station.onboarding_complete && (
                      <p className="text-xs text-orange-600 font-medium mt-0.5">Setup required</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 px-4 py-2.5 flex justify-end">
                  <Link
                    href={`/dashboard/stations/${station.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Open <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Stations (joined via invite) */}
      {memberStations.length > 0 && (
        <div className="border-t border-gray-200 pt-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Stations I&apos;ve Joined</h2>
          <div className="space-y-3">
            {memberStations.map((station) => (
              <div key={station.id} className="border border-gray-200">
                <div className="flex items-center gap-3 p-4">
                  <Fuel className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-base font-semibold text-gray-900">{station.name}</span>
                    {station.location && <p className="text-xs text-gray-500">{station.location}</p>}
                  </div>
                </div>
                <div className="border-t border-gray-100 px-4 py-2.5 flex justify-end">
                  <Link
                    href={`/dashboard/stations/${station.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Open <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="border-t border-gray-200 pt-6">
        <Link href="/dashboard/feedback" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <MessageSquare className="w-4 h-4" /> Send feedback
        </Link>
      </div>
    </div>
  )
}
