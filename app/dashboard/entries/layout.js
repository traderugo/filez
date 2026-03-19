'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useRemoteChanges } from '@/lib/hooks/useRemoteChanges'

function RealtimeSync() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  useRemoteChanges(orgId)
  return null
}

export default function EntriesLayout({ children }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <RealtimeSync />
      {children}
    </Suspense>
  )
}
