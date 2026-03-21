'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Fuel, Settings, UserPlus, Mail, LogOut, Clock,
  FileSpreadsheet, ClipboardList, CreditCard, Droplets, Users,
  ChevronRight, ChevronDown, BarChart3, Plus, Pencil, Trash2, AlertTriangle,
  FileText, ArrowUpFromLine, ArrowDownToLine, MessagesSquare, BookOpen, ShieldX, Truck
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import Modal from '@/components/Modal'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { differenceInDays } from 'date-fns'
import { fmtDate } from '@/lib/formatDate'
import { db } from '@/lib/db'
import { processQueue, clearQueue } from '@/lib/sync'
import { initialSync } from '@/lib/initialSync'
import { supabase } from '@/lib/supabaseClient'

const ENTRY_PAGE_OPTIONS = [
  { key: 'daily-sales', label: 'Daily Sales' },
  { key: 'product-receipt', label: 'Product Receipt' },
  { key: 'lodgements', label: 'Lodgements' },
  { key: 'lube', label: 'Lube' },
  { key: 'customer-payments', label: 'Accounts' },
]

const REPORT_PAGE_OPTIONS = [
  { key: 'report-summary', label: 'Summary' },
  { key: 'report-daily-sales', label: 'Daily Sales Report' },
  { key: 'report-audit', label: 'Audit Report', children: [
    { key: 'report-audit-sales-cash', label: 'Sales/Cash Position' },
    { key: 'report-audit-lodgement-sheet', label: 'Lodgement Sheet' },
    { key: 'report-audit-stock-position', label: 'Record of Stock Position' },
    { key: 'report-audit-stock-summary', label: 'Stock Position' },
    { key: 'report-audit-consumption', label: 'Consumption & Pour Back' },
    { key: 'report-audit-calculator', label: 'Calculator' },
  ]},
  { key: 'report-account-ledger', label: 'Account Ledger' },
  { key: 'report-product-received', label: 'Product Received' },
  { key: 'report-lube', label: 'Lube Report' },
]

const ALL_PAGE_KEYS = [
  ...ENTRY_PAGE_OPTIONS.map(p => p.key),
  ...REPORT_PAGE_OPTIONS.flatMap(p => p.children ? [p.key, ...p.children.map(c => c.key)] : [p.key]),
]

export default function StationPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId

  const [loading, setLoading] = useState(true)
  const [station, setStation] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [user, setUser] = useState(null)

  // Staff invite state
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [expandedStaff, setExpandedStaff] = useState(null)

  // Delete staff modal
  const [deleteModal, setDeleteModal] = useState(null) // { id, email }
  const [deleting, setDeleting] = useState(false)

  // Staff page access
  const [visiblePages, setVisiblePages] = useState(ALL_PAGE_KEYS) // default: all visible
  const [accessDeniedModal, setAccessDeniedModal] = useState(false)

  // Subscription (owner only)
  const [subscription, setSubscription] = useState(null)

  // Manage station accordion
  const [showManage, setShowManage] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Consolidation countdown
  const [consolidationCountdown, setConsolidationCountdown] = useState('')

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const [syncModal, setSyncModal] = useState(null) // { title, lines[] }
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  const pendingCount = useLiveQuery(
    () => stationId ? db.syncQueue.where('orgId').equals(stationId).count() : 0,
    [stationId],
    0
  )
  const pendingPullCount = 0

  useEffect(() => {
    function getNextConsolidation() {
      const now = new Date()
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0))
      let daysToAdd = (7 - now.getUTCDay()) % 7
      if (daysToAdd === 0 && now >= next) daysToAdd = 7
      next.setUTCDate(next.getUTCDate() + daysToAdd)
      return next
    }
    function format(ms) {
      const s = Math.floor(ms / 1000)
      const d = Math.floor(s / 86400)
      const h = Math.floor((s % 86400) / 3600)
      const m = Math.floor((s % 3600) / 60)
      const sec = s % 60
      if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`
      return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
    }
    const tick = () => setConsolidationCountdown(format(getNextConsolidation() - new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    const before = await db.syncQueue.where('orgId').equals(stationId).count()
    let result = { pushed: 0, dropped: 0, pending: 0, errors: [] }
    try { result = await processQueue() || result } catch (e) { /* offline */ }
    const lines = []
    if (before === 0) lines.push('Queue was empty — nothing to push')
    if (result.pushed > 0) lines.push(`${result.pushed} item${result.pushed > 1 ? 's' : ''} pushed successfully`)
    if (result.dropped > 0) lines.push(`${result.dropped} item${result.dropped > 1 ? 's' : ''} rejected by server`)
    if (result.pending > 0) lines.push(`${result.pending} item${result.pending > 1 ? 's' : ''} still pending`)
    if (result.errors.length > 0) {
      lines.push('')
      lines.push('Errors:')
      result.errors.forEach(e => lines.push(`• ${e}`))
    }
    if (result.pushed > 0 && result.dropped === 0 && result.pending === 0) lines.push('All synced!')
    setSyncModal({ title: 'Push Results', lines })
    setSyncing(false)
  }

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current || !stationId) return
    setRefreshing(true)
    refreshingRef.current = true
    const tables = ['dailySales', 'productReceipts', 'lodgements', 'lubeSales', 'lubeStock', 'customerPayments']
    let syncResult = null
    try {
      syncResult = await initialSync(stationId, { force: true })
    } catch (e) { /* offline */ }
    const lines = []
    for (const t of tables) {
      const local = await db[t].where('orgId').equals(stationId).count()
      const server = syncResult?.serverCounts?.[t] ?? '?'
      const label = t.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
      lines.push(`${label}: ${server} from server → ${local} local`)
    }
    setSyncModal({ title: 'Pull Results', lines })
    setRefreshing(false)
    refreshingRef.current = false
  }, [stationId])

  const handleClearQueue = async () => {
    setClearing(true)
    try {
      const result = await clearQueue(stationId)
      const lines = []
      if (result.cleared === 0) {
        lines.push('Queue was already empty.')
      } else {
        lines.push(`${result.cleared} queued item${result.cleared > 1 ? 's' : ''} cleared`)
        if (result.reverted > 0) {
          lines.push(`${result.reverted} unsaved entr${result.reverted > 1 ? 'ies' : 'y'} removed from local data`)
        }
        lines.push('', 'Pull from server to restore your data.')
      }
      setSyncModal({ title: 'Queue Cleared', lines })
    } catch {
      setSyncModal({ title: 'Error', lines: ['Failed to clear queue.'] })
    }
    setClearing(false)
    setClearConfirm(false)
  }

  useEffect(() => {
    const load = async () => {
      const [orgRes, userRes] = await Promise.all([
        fetch('/api/organizations'),
        fetch('/api/auth/me'),
      ])
      if (!orgRes.ok) { router.push('/dashboard'); return }
      const data = await orgRes.json()
      const owned = (data.stations || []).find((st) => st.id === stationId)
      const member = (data.memberStations || []).find((st) => st.id === stationId)
      const s = owned || member
      if (!s) { router.push('/dashboard'); return }
      setStation(s)
      setIsOwner(!!owned)

      if (userRes.ok) {
        const userData = await userRes.json()
        setUser(userData.user)
      }

      if (owned) {
        const [invRes, dashRes] = await Promise.all([
          fetch(`/api/invites/list?org_id=${stationId}`),
          fetch(`/api/dashboard/data?org_id=${stationId}`),
        ])
        if (invRes.ok) {
          const invData = await invRes.json()
          setInvites(invData.invites || [])
        }
        if (dashRes.ok) {
          const dashData = await dashRes.json()
          setSubscription(dashData.subscription || null)
        }
      } else {
        // Staff — fetch their visible_pages
        const permRes = await fetch(`/api/invites?org_id=${stationId}`)
        if (permRes.ok) {
          const permData = await permRes.json()
          if (permData.visiblePages) setVisiblePages(permData.visiblePages)
        }
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
    setInviteError('')
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: stationId, email: inviteEmail }),
    })
    if (res.ok) {
      setShowInviteModal(false)
      setInviteEmail('')
      loadInvites()
    } else {
      const err = await res.json().catch(() => ({}))
      setInviteError(err.error || 'Failed to invite staff')
    }
    setInviting(false)
  }

  const confirmRemoveInvite = async () => {
    if (!deleteModal) return
    setDeleting(true)
    const res = await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteModal.id }),
    })
    if (res.ok) {
      setDeleteModal(null)
      loadInvites()
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

  const leaveStation = async () => {
    if (!confirm('Leave this station? You will lose access to its entries and data.')) return
    setLeaving(true)
    const res = await fetch('/api/invites/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: stationId }),
    })
    if (res.ok) {
      router.push('/dashboard')
    }
    setLeaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const canAccess = (pageKey) => isOwner || visiblePages.includes(pageKey)

  const entryLinks = [
    { href: `/dashboard/entries/daily-sales/list?org_id=${stationId}`, icon: FileSpreadsheet, label: 'Daily Sales', desc: 'Nozzle readings, stock, pricing', pageKey: 'daily-sales' },
    { href: `/dashboard/entries/product-receipt/list?org_id=${stationId}`, icon: ClipboardList, label: 'Product Receipt', desc: 'Deliveries and waybills', pageKey: 'product-receipt' },
    { href: `/dashboard/entries/lodgements/list?org_id=${stationId}`, icon: CreditCard, label: 'Lodgements', desc: 'Deposits and POS', pageKey: 'lodgements' },
    { href: `/dashboard/entries/lube/list?org_id=${stationId}`, icon: Droplets, label: 'Lube', desc: 'Lube sales and stock', pageKey: 'lube' },
    { href: `/dashboard/entries/customer-payments/list?org_id=${stationId}`, icon: Users, label: 'Accounts', desc: 'Credit sales and payments', pageKey: 'customer-payments' },
  ]

  const reportLinks = [
    { href: `/dashboard/reports/summary?org_id=${stationId}`, icon: FileText, label: 'Summary', desc: 'Overview summary report', pageKey: 'report-summary' },
    { href: `/dashboard/reports/daily-sales-report?org_id=${stationId}`, icon: BarChart3, label: 'Daily Sales Report', desc: 'Nozzle sales, POS, and cash', pageKey: 'report-daily-sales' },
    { href: `/dashboard/reports/audit-report?org_id=${stationId}`, icon: ClipboardList, label: 'Audit Report', desc: 'Station audit trail', pageKey: 'report-audit' },
    { href: `/dashboard/reports/account-ledger?org_id=${stationId}`, icon: BookOpen, label: 'Account Ledger', desc: 'Credit accounts and balances', pageKey: 'report-account-ledger' },
    { href: `/dashboard/reports/product-received?org_id=${stationId}`, icon: Truck, label: 'Product Received', desc: 'Deliveries, waybills, shortages', pageKey: 'report-product-received' },
    { href: `/dashboard/reports/lube-report?org_id=${stationId}`, icon: Droplets, label: 'Lube Report', desc: 'Lube sales, stock, and lodgements', pageKey: 'report-lube' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">

      {/* Station header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Fuel className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{station.name}</h1>
            {station.location && <p className="text-sm text-gray-500">{station.location}</p>}
            {station.station_group && <p className="text-xs text-gray-400">{station.station_group}</p>}
          </div>
        </div>
      </div>

      {/* Sync controls */}
      <div className="mb-8 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSync}
          disabled={syncing || pendingCount === 0}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-sm transition-all disabled:opacity-40 ${
            pendingCount > 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
          Push
          {pendingCount > 0 && (
            <span className="bg-white/25 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-sm transition-all disabled:opacity-40 ${
            pendingPullCount > 0
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
          Pull
          {pendingPullCount > 0 && (
            <span className="bg-white/25 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingPullCount > 9 ? '9+' : pendingPullCount}
            </span>
          )}
        </button>
        <span className="text-xs text-gray-400">
          {pendingCount === 0 ? 'All synced' : `${pendingCount} pending`}
        </span>
        {pendingCount > 0 && (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={clearing}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Clear
          </button>
        )}
        {consolidationCountdown && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono text-gray-500">{consolidationCountdown}</span>
          </span>
        )}
      </div>

      {/* Reports */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Reports</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {reportLinks.map((link) => {
            const allowed = canAccess(link.pageKey)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={allowed ? undefined : (e) => { e.preventDefault(); setAccessDeniedModal(true) }}
                className={`flex flex-col gap-2 border p-4 transition-colors ${
                  allowed
                    ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    : 'border-gray-100 opacity-50'
                }`}
              >
                <link.icon className={`w-5 h-5 ${allowed ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{link.label}</p>
                  <p className="text-xs text-gray-500 leading-snug">{link.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Entries */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Entries</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {entryLinks.map((link) => {
            const allowed = canAccess(link.pageKey)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={allowed ? undefined : (e) => { e.preventDefault(); setAccessDeniedModal(true) }}
                className={`flex flex-col gap-2 border p-4 transition-colors ${
                  allowed
                    ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    : 'border-gray-100 opacity-50'
                }`}
              >
                <link.icon className={`w-5 h-5 ${allowed ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{link.label}</p>
                  <p className="text-xs text-gray-500 leading-snug">{link.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Chat */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Chat</h2>
        <Link
          href={`/dashboard/stations/${stationId}/chat`}
          className="flex items-center gap-3 border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
        >
          <MessagesSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Station Chat</p>
            <p className="text-xs text-gray-500">Messages and activity log for this station</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </Link>
      </section>

      {/* Sign out */}
      <section className="mb-8">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </section>

      {/* Subscription (owner only) */}
      {isOwner && (() => {
        const daysLeft = subscription?.end_date
          ? differenceInDays(new Date(subscription.end_date), new Date())
          : null
        return (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Subscription</h2>
              {subscription && <SubscriptionBadge status={subscription.status} />}
            </div>

            {subscription?.status === 'approved' ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  Expires {fmtDate(subscription.end_date)}
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
                  href={`/dashboard/subscribe?org_id=${stationId}`}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
                >
                  <CreditCard className="w-4 h-4" /> Subscribe now
                </Link>
              </div>
            )}
          </section>
        )
      })()}

      {/* Staff (owner only) */}
      {isOwner && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Staff
          </h2>

          <button
            onClick={() => { setShowInviteModal(true); setInviteEmail(''); setInviteError('') }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 mb-4"
          >
            <Plus className="w-4 h-4" /> Invite Staff
          </button>

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
                      <button
                        onClick={() => setExpandedStaff(isExpanded ? null : inv.id)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="Page access"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expanded: page permissions + delete */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Entries</p>
                        <div className="space-y-2 mb-3">
                          {ENTRY_PAGE_OPTIONS.map((page) => (
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
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reports</p>
                        <div className="space-y-2 mb-4">
                          {REPORT_PAGE_OPTIONS.map((page) => (
                            <div key={page.key}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={page.children
                                    ? page.children.every(c => pages.includes(c.key))
                                    : pages.includes(page.key)
                                  }
                                  ref={page.children ? (el) => {
                                    if (el) el.indeterminate = page.children.some(c => pages.includes(c.key)) && !page.children.every(c => pages.includes(c.key))
                                  } : undefined}
                                  onChange={() => {
                                    if (page.children) {
                                      const allChecked = page.children.every(c => pages.includes(c.key))
                                      const childKeys = page.children.map(c => c.key)
                                      const base = pages.filter(p => !childKeys.includes(p) && p !== page.key)
                                      const updated = allChecked ? base : [...base, page.key, ...childKeys]
                                      setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, visible_pages: updated } : i))
                                      fetch('/api/invites/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_id: inv.id, visible_pages: updated }) })
                                    } else {
                                      togglePagePermission(inv.id, page.key, pages)
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span className="text-sm text-gray-700">{page.label}</span>
                              </label>
                              {page.children && (
                                <div className="ml-6 mt-1 space-y-1">
                                  {page.children.map((child) => (
                                    <label key={child.key} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={pages.includes(child.key)}
                                        onChange={() => {
                                          const updated = pages.includes(child.key)
                                            ? pages.filter(p => p !== child.key)
                                            : [...pages, child.key]
                                          // Also ensure parent key is present if any child is checked
                                          const hasChild = page.children.some(c => updated.includes(c.key))
                                          const withParent = hasChild && !updated.includes(page.key) ? [...updated, page.key] : hasChild ? updated : updated.filter(p => p !== page.key)
                                          setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, visible_pages: withParent } : i))
                                          fetch('/api/invites/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_id: inv.id, visible_pages: withParent }) })
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                      />
                                      <span className="text-xs text-gray-600">{child.label}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setDeleteModal({ id: inv.id, email: inv.email })}
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
      )}

      {/* Manage Station (owner only) */}
      {isOwner && (
        <section className="mb-8">
          <button
            onClick={() => { setShowManage(!showManage); if (!showManage) setEditName(station.name) }}
            className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
          >
            Manage Station
            <ChevronDown className={`w-4 h-4 transition-transform ${showManage ? 'rotate-180' : ''}`} />
          </button>

          {showManage && (
            <div className="border border-gray-200 p-4 space-y-4">
              {!station.onboarding_complete ? (
                <Link
                  href={`/dashboard/setup/${stationId}`}
                  className="flex items-center gap-3 border border-orange-200 bg-orange-50 p-3 hover:bg-orange-100 transition-colors"
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
                  className="flex items-center gap-3 border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Station Settings</p>
                    <p className="text-sm text-gray-500">Nozzles, tanks, lodgements, products, customers</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              )}

              <div className="border-t border-gray-200 pt-4" />

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
      )}

      {/* Leave Station (members and owners) */}
      <section>
        <button
          onClick={leaveStation}
          disabled={leaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Leave Station
        </button>
      </section>

      {/* Invite Staff Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInviteError('') }}
        title="Invite Staff"
      >
        <form onSubmit={addInvite} className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter the email of the person you want to invite. They will see the invite on their dashboard after signing up or logging in.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Email</label>
            <input
              type="email"
              placeholder="staff@email.com"
              maxLength={254}
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowInviteModal(false); setInviteError('') }}
              className="flex-1 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Invite
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Not signed up yet? Share the <Link href="/auth/register" className="text-blue-600 underline">signup link</Link> with them.
          </p>
        </form>
      </Modal>

      {/* Delete Staff Modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
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

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveInvite}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear Queue Confirmation Modal */}
      <Modal open={clearConfirm} onClose={() => setClearConfirm(false)} title="Clear Pending Items?">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">This will:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Remove all {pendingCount} pending item{pendingCount > 1 ? 's' : ''} from the queue</li>
                <li>Delete any new entries that haven&apos;t been pushed yet</li>
              </ul>
              <p className="mt-2 text-gray-500">You can pull from the server afterwards to restore your data.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setClearConfirm(false)}
              className="flex-1 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleClearQueue}
              disabled={clearing}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {clearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Clear Queue
            </button>
          </div>
        </div>
      </Modal>

      {/* Sync Result Modal */}
      <Modal open={!!syncModal} onClose={() => setSyncModal(null)} title={syncModal?.title || 'Sync'}>
        <div className="space-y-2">
          {syncModal?.lines.map((line, i) => (
            <p key={i} className="text-sm text-gray-700">{line}</p>
          ))}
          <button onClick={() => setSyncModal(null)} className="w-full mt-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            OK
          </button>
        </div>
      </Modal>

      {/* Access Denied Modal */}
      <Modal open={accessDeniedModal} onClose={() => setAccessDeniedModal(false)} title="Access Denied">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded">
            <ShieldX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              You don&apos;t have permission to access this page. Contact the station owner to update your access.
            </p>
          </div>
          <button
            onClick={() => setAccessDeniedModal(false)}
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 rounded"
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  )
}
