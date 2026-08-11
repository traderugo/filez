'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'

/**
 * The station's notification list and unread count, read by the inbox, the sidebar item and
 * the header bell.
 *
 * It lives here rather than in the inbox because a badge that disagrees with the screen it
 * points at is worse than no badge. One query, one read set, three consumers.
 *
 * READ STATE IS PER DEVICE, in localStorage. station_messages has no read column, and adding
 * one means a migration applied by hand on production — a bad trade for a marker that only
 * decides what is bold. The cost is that the same person sees a badge on their phone and
 * none on their desktop; the moment that becomes worth fixing is the moment to add the
 * column and let this hook read it instead.
 *
 * Each mounted copy holds its own Set, so marking something read in the inbox would leave
 * the header badge stale until it remounted. SYNC_EVENT closes that: whoever writes
 * broadcasts, and every listener re-reads. The `storage` listener covers other tabs, which
 * never see this tab's CustomEvent.
 */

const SYNC_EVENT = 'station-notifications-read'

export const readKey = (stationId) => `stationNotificationsRead:${stationId}`

const loadRead = (stationId) => {
  try {
    const raw = localStorage.getItem(readKey(stationId))
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set() // private mode: everything simply reads as unread
  }
}

export default function useStationUnread(stationId) {
  const [read, setRead] = useState(() => new Set())

  // Read AFTER mount, not in the initializer: this renders on the server too.
  useEffect(() => {
    if (!stationId) { setRead(new Set()); return }
    setRead(loadRead(stationId))

    const resync = (e) => {
      // A StorageEvent from an unrelated key is not ours. e.key is null when storage is
      // cleared wholesale, which does concern us.
      if (e.type === 'storage' && e.key && e.key !== readKey(stationId)) return
      setRead(loadRead(stationId))
    }
    window.addEventListener(SYNC_EVENT, resync)
    window.addEventListener('storage', resync)
    return () => {
      window.removeEventListener(SYNC_EVENT, resync)
      window.removeEventListener('storage', resync)
    }
  }, [stationId])

  const persist = useCallback((next) => {
    setRead(next)
    try { localStorage.setItem(readKey(stationId), JSON.stringify([...next])) } catch {}
    window.dispatchEvent(new Event(SYNC_EVENT))
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

  const unread = useMemo(
    () => notices.filter((n) => !read.has(n.id)).length,
    [notices, read]
  )

  const markRead = useCallback((id) => {
    if (read.has(id)) return
    persist(new Set([...read, id]))
  }, [read, persist])

  // Every notice, not just the page on screen: the count in the header is a total, so
  // clearing it has to be one too.
  const markAllRead = useCallback(() => {
    persist(new Set(notices.map((n) => n.id)))
  }, [notices, persist])

  return { notices, unread, read, markRead, markAllRead }
}
