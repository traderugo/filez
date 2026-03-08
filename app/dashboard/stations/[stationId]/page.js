'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Fuel, Settings, UserPlus, Mail, KeyRound,
  FileSpreadsheet, ClipboardList, CreditCard, Droplets, Users,
  ChevronRight, ChevronDown, BarChart3, Plus, Pencil, Trash2, Copy, Check, AlertTriangle
} from 'lucide-react'
import Modal from '@/components/Modal'

const PAGE_OPTIONS = [
  { key: 'daily-sales', label: 'Daily Sales' },
  { key: 'product-receipt', label: 'Product Receipt' },
  { key: 'lodgements', label: 'Lodgements' },
  { key: 'lube', label: 'Lube' },
  { key: 'customer-payments', label: 'Customer Payments' },
]

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
  const [expandedStaff, setExpandedStaff] = useState(null)

  // Credential modal
  const [credModal, setCredModal] = useState(null) // { email, password }
  const [copied, setCopied] = useState(null) // 'email' | 'password'

  // Delete staff modal
  const [deleteModal, setDeleteModal] = useState(null) // { id, email }
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
        setCredModal({ email: data.invite.email, password: data.tempPassword })
      }
    }
    setInviting(false)
  }

  const confirmRemoveInvite = async () => {
    if (!deleteModal || !deletePassword.trim()) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteModal.id, password: deletePassword }),
    })
    if (res.ok) {
      setDeleteModal(null)
      setDeletePassword('')
      loadInvites()
    } else {
      const err = await res.json()
      setDeleteError(err.error || 'Failed to remove staff')
    }
    setDeleting(false)
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
    setResetting(email)
    try {
      const res = await fetch('/api/auth/reset-staff-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_email: email }),
      })
      if (res.ok) {
        const data = await res.json()
        setCredModal({ email, password: data.tempPassword })
      } else {
        const err = await res.json()
        setCredModal({ email, error: err.error || 'Failed to reset password' })
      }
    } catch {
      setCredModal({ email, error: 'Network error. Please try again.' })
    }
    setResetting(null)
  }

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for HTTP or unsupported contexts
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
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
            <p className="text-sm text-orange-600">Configure nozzles, tanks, and lodgements</p>
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
            <p className="text-sm text-gray-500">Nozzles, tanks, lodgements, products, customers</p>
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
                <p className="text-sm text-gray-500">{link.desc}</p>
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
            {invites.map((inv) => {
              const isExpanded = expandedStaff === inv.id
              const pages = inv.visible_pages || []
              return (
                <div key={inv.id} className="border border-gray-200">
                  {/* Staff header row */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                        <span className={`inline-block text-sm px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                          inv.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          inv.status === 'declined' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => resetStaffPassword(inv.email)}
                        disabled={resetting === inv.email}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Reset password"
                      >
                        {resetting === inv.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setExpandedStaff(isExpanded ? null : inv.id)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="Page access"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: page permissions + delete */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2">Page Access</p>
                      <div className="space-y-2 mb-4">
                        {PAGE_OPTIONS.map((page) => (
                          <label key={page.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pages.includes(page.key)}
                              onChange={() => togglePagePermission(inv.id, page.key, pages)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">{page.label}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => { setDeleteModal({ id: inv.id, email: inv.email }); setDeletePassword(''); setDeleteError('') }}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" /> Remove Staff
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
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
                <label className="block text-sm text-gray-500 mb-1">Station Name</label>
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
              <p className="text-sm text-gray-500 mb-2">Permanently delete this station and all its data.</p>
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

      {/* Credential Modal */}
      <Modal open={!!credModal} onClose={() => setCredModal(null)} title={credModal?.error ? 'Error' : 'Staff Credentials'}>
        {credModal && credModal.error ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{credModal.error}</p>
                <p className="text-sm text-red-600 mt-1">Could not reset password for {credModal.email}.</p>
              </div>
            </div>
            <button
              onClick={() => setCredModal(null)}
              className="w-full py-2 bg-gray-600 text-white text-sm font-medium hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        ) : credModal ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Share these credentials with the staff member. They will be asked to change their password on first login.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 text-sm text-gray-900 select-all">
                  {credModal.email}
                </div>
                <button
                  onClick={() => copyToClipboard(credModal.email, 'email')}
                  className="p-2 border border-gray-200 hover:bg-gray-50"
                  title="Copy email"
                >
                  {copied === 'email' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 text-sm text-gray-900 font-mono select-all">
                  {credModal.password}
                </div>
                <button
                  onClick={() => copyToClipboard(credModal.password, 'password')}
                  className="p-2 border border-gray-200 hover:bg-gray-50"
                  title="Copy password"
                >
                  {copied === 'password' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setCredModal(null)}
              className="w-full py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : null}
      </Modal>

      {/* Delete Staff Modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => { setDeleteModal(null); setDeletePassword(''); setDeleteError('') }}
        title="Remove Staff"
      >
        {deleteModal && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">This action cannot be undone</p>
                <p className="text-sm text-red-600 mt-1">
                  You are about to remove <strong>{deleteModal.email}</strong> from this station. They will lose access immediately.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter your password to confirm</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                placeholder="Your password"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
              {deleteError && <p className="text-sm text-red-600 mt-1">{deleteError}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteModal(null); setDeletePassword(''); setDeleteError('') }}
                className="flex-1 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveInvite}
                disabled={deleting || !deletePassword.trim()}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
