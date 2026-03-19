'use client'

import { Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { useRemoteChanges } from '@/lib/hooks/useRemoteChanges'

function BackgroundSync() {
  const searchParams = useSearchParams()
  const params = useParams()
  // org_id from search params (entries, reports) or stationId from URL (station hub)
  const orgId = searchParams.get('org_id') || params?.stationId || ''
  useRemoteChanges(orgId)
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
