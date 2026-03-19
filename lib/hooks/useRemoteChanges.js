'use client'

import { useEffect, useRef, useCallback } from 'react'
import { db } from '@/lib/db'
import { normalizeEntry } from '@/lib/sync'

const POLL_INTERVAL = 60_000 // 60 seconds

/**
 * Poll for remote changes every 60s when the tab is visible.
 * Fetches only entries updated since the last poll, then upserts
 * them into IndexedDB. useLiveQuery picks up changes automatically.
 */
export function useRemoteChanges(orgId) {
  const lastPollRef = useRef(null)
  const pollingRef = useRef(false)

  const poll = useCallback(async () => {
    if (!orgId || pollingRef.current) return
    pollingRef.current = true

    try {
      const since = lastPollRef.current || new Date(Date.now() - POLL_INTERVAL).toISOString()
      const res = await fetch(`/api/entries/poll?org_id=${orgId}&since=${encodeURIComponent(since)}`)
      if (!res.ok) return

      const { changes, polledAt } = await res.json()
      if (polledAt) lastPollRef.current = polledAt

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

    // Poll immediately on mount
    poll()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, POLL_INTERVAL)

    // Also poll when tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orgId, poll])

  // Keep backward-compat return shape
  return { pendingPullCount: 0, resetPullCount: () => {} }
}
