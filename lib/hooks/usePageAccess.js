'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to check if the current user has access to a specific page/feature
 * and whether they are the station owner.
 *
 * @param {string} orgId - The organization/station ID
 * @param {string} pageKey - The permission key (e.g. 'report-audit', 'imprest')
 * @returns {{ loading: boolean, allowed: boolean, isOwner: boolean, visiblePages: string[] }}
 */
export function usePageAccess(orgId, pageKey) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [visiblePages, setVisiblePages] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }

    let cancelled = false
    const check = async () => {
      try {
        // Check ownership
        const orgRes = await fetch('/api/organizations')
        if (cancelled) return
        const orgData = orgRes.ok ? await orgRes.json() : {}
        const owned = (orgData.stations || []).some(s => s.id === orgId)
        setIsOwner(owned)

        if (owned) {
          // Owner has access to everything
          setAllowed(true)
          setVisiblePages([])
          setLoading(false)
          return
        }

        // Staff — check permissions
        const permRes = await fetch(`/api/invites?org_id=${orgId}`)
        if (cancelled) return
        const permData = permRes.ok ? await permRes.json() : {}
        const pages = permData.visiblePages || []
        setVisiblePages(pages)
        setAllowed(pages.includes(pageKey))
      } catch {
        setAllowed(false)
      }
      if (!cancelled) setLoading(false)
    }
    check()
    return () => { cancelled = true }
  }, [orgId, pageKey])

  return { loading, allowed, isOwner, visiblePages }
}
