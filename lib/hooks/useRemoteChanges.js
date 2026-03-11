'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

const ENTRY_TABLES = [
  'daily_sales_entries',
  'product_receipt_entries',
  'lodgement_entries',
  'lube_sales_entries',
  'lube_stock_entries',
  'customer_payment_entries',
  'consumption_entries',
]

/**
 * Subscribe to Supabase Realtime postgres_changes on all entry tables
 * for the given org. Returns a count of remote changes since last reset.
 *
 * Call resetPullCount() after pulling/refreshing data.
 */
export function useRemoteChanges(orgId) {
  const [pendingPullCount, setPendingPullCount] = useState(0)
  const resetPullCount = useCallback(() => setPendingPullCount(0), [])

  useEffect(() => {
    if (!orgId || !supabase) return

    const channel = supabase.channel(`remote-changes-${orgId}`)

    for (const table of ENTRY_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` },
        () => setPendingPullCount(c => c + 1)
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId])

  return { pendingPullCount, resetPullCount }
}
