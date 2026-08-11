'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Inbox, RefreshCw, Loader2, CheckCheck } from 'lucide-react'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/formatDate'
import { EmptyState, OUTLINE } from '@/components/ui'

/**
 * Notifications — the station's activity inbox. Replaces the chat log.
 *
 * The old screen mixed two different things in one stream: `activity` rows written
 * automatically by lib/entryHelpers.js ("added a lodgement entry"), and `message` rows staff
 * typed to each other. Only the first is a notification, and the second was carrying the
 * weight of being a chat product — mentions, deletes, run-collapsing — inside a log.
 *
 * This shows the activity, in the shape store-portal's Messages inbox uses: a typed chip, a
 * one-line summary, tap to expand, read/unread.
 *
 * READ STATE IS PER DEVICE, in localStorage. station_messages has no read column, and
 * adding one means a migration applied by hand on production — which is a bad trade for a
 * marker that only affects what this screen bolds. If read state ever needs to follow a
 * user across devices, that is the point to add the column.
 */

// Chip label + tint per action_type. Unknown types fall back to a neutral "Activity".
const TYPE_META = {
  created_entry:        { label: 'Entry',        chip: 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' },
  updated_entry:        { label: 'Edit',         chip: 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' },
  imprest_period:       { label: 'Imprest',      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  invite_created:       { label: 'Staff',        chip: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  invite_removed:       { label: 'Staff',        chip: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  permissions_changed:  { label: 'Access',       chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  staff_password_reset: { label: 'Access',       chip: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  left_station:         { label: 'Staff',        chip: 'bg-subtle text-content-muted' },
  onboarding_saved:     { label: 'Setup',        chip: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  subscription_started: { label: 'Subscription', chip: 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' },
}
const FALLBACK = { label: 'Activity', chip: 'bg-subtle text-content-muted' }

const readKey = (stationId) => `stationNotificationsRead:${stationId}`

export default function NotificationsPage() {
  const params = useParams()
  const stationId = params.stationId

  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [read, setRead] = useState(() => new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(readKey(stationId))
      setRead(new Set(raw ? JSON.parse(raw) : []))
    } catch { /* private mode: everything simply reads as unread */ }
  }, [stationId])

  const persist = useCallback((next) => {
    setRead(next)
    try { localStorage.setItem(readKey(stationId), JSON.stringify([...next])) } catch {}
  }, [stationId])

  const rows = useLiveQuery(
    () => stationId
      ? db.stationMessages.where('orgId').equals(stationId).sortBy('createdAt')
      : [],
    [stationId],
    []
  )

  // Activity only. Any legacy typed messages stay in the table but are not an inbox item.
  const notices = useMemo(
    () => (rows || []).filter((r) => r.type === 'activity' && !r.deletedAt).reverse(),
    [rows]
  )

  const unread = notices.filter((n) => !read.has(n.id)).length

  const refresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/chat?org_id=${stationId}`, { cache: 'no-store' })
      if (res.ok) {
        const { messages } = await res.json()
        if (messages?.length) {
          await db.stationMessages.bulkPut(messages.map((m) => ({
            id: m.id, orgId: m.org_id, userId: m.user_id, userName: m.user_name,
            type: m.type, content: m.content, actionType: m.action_type,
            deletedAt: m.deleted_at || null, createdAt: m.created_at,
          })))
        }
      }
    } catch { /* offline — the local mirror is still shown */ }
    setRefreshing(false)
  }

  useEffect(() => { if (stationId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  const open = (n) => {
    setExpanded(expanded === n.id ? null : n.id)
    if (!read.has(n.id)) persist(new Set([...read, n.id]))
  }

  const markAllRead = () => persist(new Set(notices.map((n) => n.id)))

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-content">Notifications</h1>
          <p className="text-sm text-content-muted">
            {unread > 0 ? `${unread} unread` : 'Everything read'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <button onClick={markAllRead} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${OUTLINE} hover:bg-primary-500/20`}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          <button onClick={refresh} disabled={refreshing} aria-label="Refresh"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${OUTLINE} hover:bg-primary-500/20`}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {notices.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing yet">
          Entries, staff changes and subscription events show up here.
        </EmptyState>
      ) : (
        <div className="border-card border-primary-500/40 dark:border-primary-400/40 divide-y divide-line">
          {notices.map((n) => {
            const meta = TYPE_META[n.actionType] || FALLBACK
            const isRead = read.has(n.id)
            const isOpen = expanded === n.id
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className="w-full text-left px-3 py-3 hover:bg-subtle transition-colors block"
              >
                <div className="flex items-center gap-2">
                  {/* An unread marker rather than a bold row: bold on a dense list reads as
                      emphasis on the words, not as "new". */}
                  <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRead ? 'bg-transparent' : 'bg-primary-500'}`} />
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 shrink-0 ${meta.chip}`}>{meta.label}</span>
                  <span className={`text-sm flex-1 min-w-0 truncate ${isRead ? 'text-content-muted' : 'text-content font-medium'}`}>
                    {n.userName ? `${n.userName} ` : ''}{n.content}
                  </span>
                  <span className="text-[11px] text-content-faint shrink-0">{fmtDate(n.createdAt)}</span>
                </div>
                {isOpen && (
                  <p className="text-sm text-content-muted mt-2 pl-6">
                    {n.content}
                    {n.userName ? ` — ${n.userName}` : ''}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
