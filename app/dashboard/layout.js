'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { useRemoteChanges } from '@/lib/hooks/useRemoteChanges'
import { initialSync } from '@/lib/initialSync'
import { repairSync } from '@/lib/sync'
import SavePushProvider from '@/components/SavePushProvider'

function BackgroundSync() {
  const searchParams = useSearchParams()
  const params = useParams()
  // org_id from search params (entries, reports) or stationId from URL (station hub)
  const orgId = searchParams.get('org_id') || params?.stationId || ''
  useRemoteChanges(orgId)
  const backfillRef = useRef(null) // org currently being backfilled (dedupes re-renders)

  // Full history backfill into the local mirror. Reports are computed in the browser from this
  // mirror, so without a complete download a device only holds the entries it authored plus the
  // ~24h useRemoteChanges polls back, and cumulative/opening-balance figures come out wrong,
  // differently on each device. initialSync is gated by the synced flag + SYNC_VERSION, so this
  // does the heavy pull once (and once more when SYNC_VERSION bumps, healing partial mirrors)
  // and is a cheap no-op afterwards. On a partial/failed sync the flag is left unset, so we
  // clear the ref to allow a retry.
  useEffect(() => {
    if (!orgId || backfillRef.current === orgId) return
    backfillRef.current = orgId
    initialSync(orgId)
      .then((r) => { if (!r || r.complete === false) backfillRef.current = null })
      .catch((e) => { backfillRef.current = null; console.warn('[BackgroundSync] backfill failed, will retry', e?.message) })
  }, [orgId])

  // One-time repair: re-queue lodgements that were dropped due to missing 'transfer' type
  useEffect(() => {
    if (orgId) repairSync('lodgement-repair-v4', 'lodgements', orgId)
  }, [orgId])

  return null
}

export default function DashboardLayout({ children }) {
  return (
    <Suspense>
      <BackgroundSync />
      <SavePushProvider>
        {children}
      </SavePushProvider>
    </Suspense>
  )
}
