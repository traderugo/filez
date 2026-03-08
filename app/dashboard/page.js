'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Clock, CreditCard, MessageSquare, Loader2, FileSpreadsheet, Droplets,
  ClipboardList, Building2, Check, LogOut, Plus, X,
  Fuel, ChevronRight
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

      {/* My Stations (manager only) */}
      {!isStaff && <div className="border-t border-gray-200 pt-6 mb-8">
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
                className="flex items-center gap-3 border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
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
                className="flex items-center gap-3 border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
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
                className="flex items-center gap-3 border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
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
                className="flex items-center gap-3 border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
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
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
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
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
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
