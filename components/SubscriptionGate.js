'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { ENTRY_SERVICE_MAP } from '@/lib/entryHelpers'

/**
 * Wraps entry form content. When unsubscribed, renders children as read-only
 * and replaces the save button area with a subscribe prompt.
 *
 * Props:
 *   orgId       - station id
 *   entryType   - key from ENTRY_SERVICE_MAP (e.g. 'daily-sales')
 *   children    - form content (always rendered)
 *   renderAction - (subscribed) => JSX — the save/submit button area
 */
export default function SubscriptionGate({ orgId, entryType, children, renderAction }) {
  const serviceKey = ENTRY_SERVICE_MAP[entryType]
  const { subscribed, loading } = useSubscription(orgId, serviceKey)

  return (
    <>
      {!loading && !subscribed && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3 mb-4 flex items-center gap-3">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 font-medium">Subscribe to add entries</p>
            <p className="text-xs text-amber-600">You can view existing data, but creating new entries requires an active subscription.</p>
          </div>
          <Link
            href="/dashboard/subscribe"
            className="flex-shrink-0 bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700"
          >
            Subscribe
          </Link>
        </div>
      )}
      {children}
      {renderAction ? renderAction(subscribed || loading) : null}
    </>
  )
}
