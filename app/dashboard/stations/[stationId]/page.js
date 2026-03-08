'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Fuel, Settings, UserPlus, Mail, X, KeyRound,
  FileSpreadsheet, ClipboardList, CreditCard, Droplets, Users,
  ChevronRight, ChevronDown, BarChart3, Plus, Pencil, Trash2
} from 'lucide-react'

export default function StationPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId

  const [loading, setLoading] = useState(true)
  const [station, setStation] = useState(null)

  // Staff invite state
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [resetting, setResetting] = useState(null)

  // Manage station accordion
  const [showManage, setShowManage] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/organizations')
      if (!res.ok) { router.push('/dashboard'); return }
      const data = await res.json()
      const s = (data.stations || []).find((st) => st.id === stationId)
      if (!s) { router.push('/dashboard'); return }
      setStation(s)

      // Load invites
      const invRes = await fetch(`/api/invites/list?org_id=${stationId}`)
      if (invRes.ok) {
        const invData = await invRes.json()
        setInvites(invData.invites || [])
      }
      setLoading(false)
    }
    load()
  }, [stationId, router])

  const loadInvites = async () => {
    const res = await fetch(`/api/invites/list?org_id=${stationId}`)
    if (res.ok) {
      const data = await res.json()
      setInvites(data.invites || [])
    }
  }

  const addInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: stationId, email: inviteEmail }),
    })
    if (res.ok) {
      const data = await res.json()
      setInviteEmail('')
      loadInvites()
      if (data.tempPassword) {
        alert(`Account created for ${data.invite.email}\n\nTemporary password: ${data.tempPassword}\n\nShare this with them. They will be asked to change it on first login.`)
      }
    }
    setInviting(false)
  }

  const removeInvite = async (inviteId) => {
    await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inviteId }),
    })
    loadInvites()
  }

  const togglePagePermission = async (inviteId, pageKey, currentPages) => {
    const updated = currentPages.includes(pageKey)
      ? currentPages.filter((p) => p !== pageKey)
      : [...currentPages, pageKey]
    setInvites((prev) => prev.map((inv) =>
      inv.id === inviteId ? { ...inv, visible_pages: updated } : inv
    ))
    await fetch('/api/invites/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId, visible_pages: updated }),
    })
  }

  const updateStation = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return
    setSaving(true)
    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stationId, name: editName }),
    })
    if (res.ok) {
      setStation((prev) => ({ ...prev, name: editName.trim() }))
    }
    setSaving(false)
  }

  const deleteStation = async () => {
    if (!confirm(`Delete "${station.name}"? All staff, data, and subscriptions for this station will be permanently removed.`)) return
    await fetch('/api/organizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stationId }),
    })
    router.push('/dashboard')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const entryLinks = [
    { href: '/dashboard/entries/daily-sales', icon: FileSpreadsheet, label: 'Daily Sales', desc: 'Nozzle readings, stock, and pricing' },
    { href: '/dashboard/entries/product-receipt', icon: ClipboardList, label: 'Product Receipt', desc: 'Deliveries, waybills, and compartments' },
    { href: '/dashboard/entries/lodgements', icon: CreditCard, label: 'Lodgements', desc: 'Deposits, lube deposits, and POS' },
    { href: '/dashboard/entries/lube', icon: Droplets, label: 'Lube', desc: 'Lube sales and stock entries' },
    { href: '/dashboard/entries/customer-payments', icon: Users, label: 'Customer Payments', desc: 'Credit sales and payments' },
  ]

  return (
    <div className="max-w-lg px-4 sm:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Fuel className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">{station.name}</h1>
          {station.location && <p className="text-sm text-gray-500">{station.location}</p>}
        </div>
      </div>

      {/* Setup / Settings */}
      {!station.onboarding_complete ? (
        <Link
          href={`/dashboard/setup/${stationId}`}
          className="flex items-center gap-3 border border-orange-200 bg-orange-50 p-4 mb-6 hover:bg-orange-100 transition-colors"
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
          href={`/dashboard/stations/${stationId}/settings`}
          className="flex items-center gap-3 border border-gray-200 p-4 mb-6 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Station Settings</p>
            <p className="text-xs text-gray-500">Nozzles, tanks, lodgements, products, customers</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>
      )}

      {/* Entries */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Entries</h2>
        <div className="grid gap-2">
          {entryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
            >
              <link.icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{link.label}</p>
                <p className="text-xs text-gray-500">{link.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </Link>
          ))}
        </div>
      </section>

      {/* Reports (coming soon) */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Reports</h2>
        <div className="border border-dashed border-gray-300 p-6 text-center">
          <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Reports coming soon</p>
        </div>
      </section>

      {/* Staff */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Staff
        </h2>

        <form onSubmit={addInvite} className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Mail className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="staff@email.com"
              maxLength={254}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Invite
          </button>
        </form>

        {invites.length > 0 && (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="bg-gray-50 px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{inv.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="Reset password"
                    >
                      {resetting === inv.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => removeInvite(inv.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Page permissions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500">Pages:</span>
                  {[
                    { key: 'daily-sales', label: 'Daily Sales' },
                    { key: 'product-receipt', label: 'Product Receipt' },
                    { key: 'lodgements', label: 'Lodgements' },
                    { key: 'lube', label: 'Lube' },
                    { key: 'customer-payments', label: 'Customer Payments' },
                  ].map((page) => (
                    <label key={page.key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(inv.visible_pages || []).includes(page.key)}
                        onChange={() => togglePagePermission(inv.id, page.key, inv.visible_pages || [])}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-600">{page.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manage Station */}
      <section>
        <button
          onClick={() => { setShowManage(!showManage); if (!showManage) setEditName(station.name) }}
          className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
        >
          Manage Station
          <ChevronDown className={`w-4 h-4 transition-transform ${showManage ? 'rotate-180' : ''}`} />
        </button>

        {showManage && (
          <div className="border border-gray-200 p-4 space-y-4">
            <form onSubmit={updateStation} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Station Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Rename
              </button>
            </form>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500 mb-2">Permanently delete this station and all its data.</p>
              <button
                onClick={deleteStation}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" /> Delete Station
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
