'use client'

import { useEffect, useRef, useCallback } from 'react'
import { db } from '@/lib/db'
import { normalizeEntry } from '@/lib/sync'

const POLL_INTERVAL = 60_000 // 60 seconds

/**
 * Poll for remote changes every 60s when the tab is visible.
 * Persists the last poll timestamp in syncMeta so it survives page reloads.
 * On first ever poll, fetches changes from the last 24 hours.
 */
export function useRemoteChanges(orgId) {
  const pollingRef = useRef(false)
  const lastPollRef = useRef(null) // in-memory cache of persisted timestamp

  const poll = useCallback(async () => {
    if (!orgId || pollingRef.current) return
    pollingRef.current = true

    try {
      // Load persisted timestamp on first poll
      if (!lastPollRef.current) {
        const meta = await db.syncMeta.get(`lastPoll:${orgId}`)
        lastPollRef.current = meta?.timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }

      const res = await fetch(`/api/entries/poll?org_id=${orgId}&since=${encodeURIComponent(lastPollRef.current)}`)
      if (!res.ok) return

      const { changes, polledAt } = await res.json()
      if (polledAt) {
        lastPollRef.current = polledAt
        await db.syncMeta.put({ key: `lastPoll:${orgId}`, timestamp: polledAt })
      }

      if (!changes) return
      for (const [localTable, records] of Object.entries(changes)) {
        for (const record of records) {
          try {
            const normalized = normalizeEntry(localTable, record, orgId)
            const existing = await db[localTable].get(record.id)
            if (existing?.sourceKey) normalized.sourceKey = existing.sourceKey
            await db[localTable].put(normalized)
          } catch { /* skip bad record */ }
        }
      }
    } catch {
      // Network error — skip, retry next cycle
    } finally {
      pollingRef.current = false
    }
  }, [orgId])

  useEffect(() => {
    if (!orgId) return

    poll()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, POLL_INTERVAL)

    const onVisible = () => {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orgId, poll])

  return { pendingPullCount: 0, resetPullCount: () => {} }
}
