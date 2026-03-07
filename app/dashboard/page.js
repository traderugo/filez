'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Clock, CreditCard, MessageSquare, Loader2, FileSpreadsheet, Droplets,
  ClipboardList, Building2, Check, LogOut, Plus, Pencil, X, Trash2,
  Mail, UserPlus, Fuel, Copy, Settings, ChevronRight, KeyRound
} from 'lucide-react'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { format, differenceInDays } from 'date-fns'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  // Invites (staff)
  const [invites, setInvites] = useState([])
  const [accepting, setAccepting] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const [visiblePages, setVisiblePages] = useState(null)

  // Stations (manager)
  const [stations, setStations] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [stationInvites, setStationInvites] = useState({})
  const [inviteEmail, setInviteEmail] = useState({})
  const [inviting, setInviting] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [resetting, setResetting] = useState(null)

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
      const list = data.stations || []
      setStations(list)
      // Load invites per station
      const allInvites = {}
      await Promise.all(list.map(async (s) => {
        const r = await fetch(`/api/invites/list?org_id=${s.id}`)
        if (r.ok) {
          const d = await r.json()
          allInvites[s.id] = d.invites || []
        }
      }))
      setStationInvites(allInvites)
    }
  }

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setSubscription(data.subscription)
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

  const leaveStation = async () => {
    if (!confirm('Leave this station? You will lose access to its reports and data.')) return
    setLeaving(true)
    const res = await fetch('/api/invites/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const r = await fetch('/api/dashboard/data')
      if (r.ok) { const d = await r.json(); setProfile(d.profile) }
      loadInvites()
    }
    setLeaving(false)
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

  const updateStation = async (id) => {
    if (!editName.trim()) return
    setSaving(true)
    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName }),
    })
    if (res.ok) { setEditingId(null); loadStations() }
    setSaving(false)
  }

  const deleteStation = async (id, name) => {
    if (!confirm(`Delete "${name}"? All staff, data, and subscriptions for this station will be permanently removed.`)) return
    await fetch('/api/organizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadStations()
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
      const data = await res.json()
      setInviteEmail((prev) => ({ ...prev, [stationId]: '' }))
      const r = await fetch(`/api/invites/list?org_id=${stationId}`)
      if (r.ok) {
        const d = await r.json()
        setStationInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
      }
      // Show temp password for newly created staff
      if (data.tempPassword) {
        alert(`Account created for ${data.invite.email}\n\nTemporary password: ${data.tempPassword}\n\nShare this with them. They will be asked to change it on first login.`)
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
    const r = await fetch(`/api/invites/list?org_id=${stationId}`)
    if (r.ok) {
      const d = await r.json()
      setStationInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
    }
  }

  const togglePagePermission = async (inviteId, stationId, pageKey, currentPages) => {
    const updated = currentPages.includes(pageKey)
      ? currentPages.filter((p) => p !== pageKey)
      : [...currentPages, pageKey]
    // Optimistic update
    setStationInvites((prev) => ({
      ...prev,
      [stationId]: (prev[stationId] || []).map((inv) =>
        inv.id === inviteId ? { ...inv, visible_pages: updated } : inv
      ),
    }))
    await fetch('/api/invites/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId, visible_pages: updated }),
    })
  }

  const resetStaffPassword = async (email) => {
    if (!confirm(`Reset password for ${email}? A new temporary password will be generated.`)) return
    setResetting(email)
    const res = await fetch('/api/auth/reset-staff-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_email: email }),
    })
    if (res.ok) {
      const data = await res.json()
      alert(`Password reset for ${email}\n\nNew temporary password: ${data.tempPassword}\n\nShare this with them. They will be asked to change it on next login.`)
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to reset password')
    }
    setResetting(null)
  }

  const copyLink = (slug, id) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${slug}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Staff = belongs to a station but doesn't own any stations
  const isStaff = profile?.org_id && stations.length === 0

  const daysLeft = subscription?.end_date
    ? differenceInDays(new Date(subscription.end_date), new Date())
    : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome, {profile?.name}</h1>
      <p className="text-sm text-gray-500 mb-8">{profile?.email}</p>

      {/* Pending station invites (staff) */}
      {invites.length > 0 && (
        <div className="mb-8 space-y-3">
          {invites.map((inv) => (
            <div key={inv.id} className="border border-blue-200 bg-blue-50 rounded-lg p-4">
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
                    className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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

      {/* My Stations (manager only) */}
      {!isStaff && <div className="border-t border-gray-200 pt-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">My Stations</h2>
          {subscription?.status === 'approved' ? (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add station
            </button>
          ) : (
            <Link
              href="/dashboard/subscribe"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
            >
              <CreditCard className="w-3.5 h-3.5" /> Subscribe to add stations
            </Link>
          )}
        </div>

        {showAdd && (
          <form onSubmit={addStation} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Station name (e.g. MRS Lekki Phase 1)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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

        {stations.length === 0 && !showAdd ? (
          <div className="text-center py-8">
            <Fuel className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No stations yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stations.map((station) => (
              <div key={station.id} className="border border-gray-200 rounded-lg p-4">
                {/* Station name */}
                <div className="flex items-center gap-3 mb-3">
                  <Fuel className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  {editingId === station.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={100}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button onClick={() => updateStation(station.id)} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
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

                {/* Setup notice / settings link */}
                {!station.onboarding_complete ? (
                  <Link
                    href={`/dashboard/setup/${station.id}`}
                    className="flex items-center gap-3 border border-orange-200 bg-orange-50 rounded-md p-3 mb-3 hover:bg-orange-100 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-800">Set up this station</p>
                      <p className="text-xs text-orange-600">Configure nozzles, tanks, and lodgements</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  </Link>
                ) : (
                  <Link
                    href={`/dashboard/setup/${station.id}`}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 mb-3"
                  >
                    <Settings className="w-3.5 h-3.5" /> Edit station setup
                  </Link>
                )}

                {/* Subscribe link */}
                <div className="mb-3">
                  <Link
                    href={`/dashboard/subscribe?station=${station.id}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Subscribe for this station
                  </Link>
                </div>

                {/* Invite link */}
                <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2 mb-3">
                  <Copy className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
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
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={inviting === station.id || !inviteEmail[station.id]?.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {inviting === station.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Invite
                    </button>
                  </form>

                  {(stationInvites[station.id] || []).length > 0 && (
                    <div className="space-y-2">
                      {stationInvites[station.id].map((inv) => (
                        <div key={inv.id} className="bg-gray-50 rounded px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => resetStaffPassword(inv.email)}
                                disabled={resetting === inv.email}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title="Reset password"
                              >
                                {resetting === inv.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => removeInvite(inv.id, station.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {/* Page permissions */}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-gray-500">Pages:</span>
                            {[
                              { key: 'daily-sales', label: 'Daily Sales' },
                              { key: 'product-receipt', label: 'Product Receipt' },
                              { key: 'lodgements', label: 'Lodgements' },
                              { key: 'lube', label: 'Lube' },
                            ].map((page) => (
                              <label key={page.key} className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(inv.visible_pages || []).includes(page.key)}
                                  onChange={() => togglePagePermission(inv.id, station.id, page.key, inv.visible_pages || [])}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                />
                                <span className="text-[10px] text-gray-600">{page.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Entries — only show if user belongs to a station (as staff) and has visible pages */}
      {profile?.org_id && visiblePages && visiblePages.length > 0 && (
        <div className="border-t border-gray-200 pt-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            <ClipboardList className="w-4 h-4 inline mr-1" />
            Entries
          </h2>
          <div className="grid gap-3">
            {visiblePages.includes('daily-sales') && (
              <Link
                href="/dashboard/entries/daily-sales"
                className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Daily Sales</p>
                  <p className="text-xs text-gray-500">Nozzle readings, stock, and pricing</p>
                </div>
              </Link>
            )}
            {visiblePages.includes('product-receipt') && (
              <Link
                href="/dashboard/entries/product-receipt"
                className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <ClipboardList className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Product Receipt</p>
                  <p className="text-xs text-gray-500">Deliveries, waybills, and compartments</p>
                </div>
              </Link>
            )}
            {visiblePages.includes('lodgements') && (
              <Link
                href="/dashboard/entries/lodgements"
                className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Lodgements</p>
                  <p className="text-xs text-gray-500">Deposits, lube deposits, and POS</p>
                </div>
              </Link>
            )}
            {visiblePages.includes('lube') && (
              <Link
                href="/dashboard/entries/lube"
                className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <Droplets className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Lube</p>
                  <p className="text-xs text-gray-500">Lube sales and stock entries</p>
                </div>
              </Link>
            )}
          </div>
          <button
            onClick={leaveStation}
            disabled={leaving}
            className="mt-4 flex items-center gap-1 text-xs text-gray-400 hover:text-red-600"
          >
            {leaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Leave station
          </button>
        </div>
      )}

      {/* Subscription status (manager only) */}
      {!isStaff && (
        <div className="border-t border-gray-200 pt-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Subscription</h2>
            {subscription && <SubscriptionBadge status={subscription.status} />}
          </div>

          {subscription?.status === 'approved' ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                Expires {format(new Date(subscription.end_date), 'MMM d, yyyy')}
                {daysLeft !== null && daysLeft <= 7 && (
                  <span className="text-orange-500 font-medium">({daysLeft} days left)</span>
                )}
              </div>
              {daysLeft !== null && daysLeft <= 7 && (
                <Link href="/dashboard/subscribe" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm font-medium">
                  <CreditCard className="w-4 h-4" /> Renew now
                </Link>
              )}
            </div>
          ) : subscription?.status === 'pending_payment' ? (
            <div>
              <p className="text-sm text-yellow-700 mb-3">You have a subscription awaiting payment.</p>
              <Link
                href={`/dashboard/subscribe/pay/${subscription.id}`}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                <CreditCard className="w-4 h-4" /> Complete payment
              </Link>
            </div>
          ) : subscription?.status === 'pending_approval' ? (
            <p className="text-sm text-blue-700">Your payment proof is being reviewed. You&apos;ll be notified once approved.</p>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                {subscription?.status === 'expired' ? 'Your subscription has expired.' :
                 subscription?.status === 'rejected' ? 'Your subscription was rejected.' :
                 'You don\'t have an active subscription.'}
              </p>
              <Link
                href="/dashboard/subscribe"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                <CreditCard className="w-4 h-4" /> Subscribe now
              </Link>
            </div>
          )}
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
