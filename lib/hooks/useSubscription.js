'use client'

import { useState, useEffect } from 'react'

/**
 * Client-side hook to check if the current station has an active subscription
 * for a given service key.
 *
 * Returns { subscribed, loading, grace }
 * - subscribed: true if approved or within 7-day grace
 * - grace: true if in grace period (expired < 7 days ago)
 * - loading: true while fetching
 */
export function useSubscription(orgId, serviceKey) {
  const [state, setState] = useState({ subscribed: false, loading: true, grace: false })

  useEffect(() => {
    if (!orgId || !serviceKey) {
      setState({ subscribed: false, loading: false, grace: false })
      return
    }

    let cancelled = false

    fetch(`/api/subscription-check?org_id=${orgId}&service=${serviceKey}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setState({
            subscribed: data.subscribed ?? false,
            grace: data.grace ?? false,
            loading: false,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ subscribed: false, loading: false, grace: false })
      })

    return () => { cancelled = true }
  }, [orgId, serviceKey])

  return state
}
