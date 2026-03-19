'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { useRemoteChanges } from '@/lib/hooks/useRemoteChanges'
import { repairSync } from '@/lib/sync'

function BackgroundSync() {
  const searchParams = useSearchParams()
  const params = useParams()
  // org_id from search params (entries, reports) or stationId from URL (station hub)
  const orgId = searchParams.get('org_id') || params?.stationId || ''
  useRemoteChanges(orgId)

  // One-time repair: re-queue lodgements that were dropped due to missing 'transfer' type
  useEffect(() => {
    if (orgId) repairSync('lodgement-repair-v1', 'lodgements', orgId)
  }, [orgId])

  return null
}

export default function DashboardLayout({ children }) {
  return (
    <Suspense>
      <BackgroundSync />
      {children}
    </Suspense>
  )
}
