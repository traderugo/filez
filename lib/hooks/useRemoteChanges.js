'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { db } from '@/lib/db'
import { normalizeEntry } from '@/lib/sync'

// Maps Supabase table names → local Dexie table names
const TABLE_MAP = {
  daily_sales_entries:      'dailySales',
  product_receipt_entries:   'productReceipts',
  lodgement_entries:         'lodgements',
  lube_sales_entries:        'lubeSales',
  lube_stock_entries:        'lubeStock',
  customer_payment_entries:  'customerPayments',
  consumption_entries:       'consumption',
}

const ENTRY_TABLES = Object.keys(TABLE_MAP)

/**
 * Subscribe to Supabase Realtime postgres_changes on all entry tables
 * for the given org. Applies INSERT/UPDATE/DELETE directly to IndexedDB
 * so the UI updates instantly via useLiveQuery.
 *
 * Keeps pendingPullCount + resetPullCount for backward compat (Pull button).
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
        (payload) => {
          const localTable = TABLE_MAP[table]
          if (!localTable) return
          applyChange(localTable, orgId, payload)
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId])

  return { pendingPullCount, resetPullCount }
}

/**
 * Apply a single Realtime change directly to IndexedDB.
 * put() is idempotent so echoes from our own pushes are harmless.
 */
async function applyChange(localTable, orgId, payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  try {
    if (eventType === 'DELETE') {
      const id = oldRecord?.id
      if (!id) return
      await db[localTable].delete(id)
      return
    }

    // INSERT or UPDATE
    const record = newRecord
    if (!record?.id) return

    const normalized = normalizeEntry(localTable, record, orgId)

    // Preserve any local-only fields (e.g. sourceKey)
    const existing = await db[localTable].get(record.id)
    if (existing?.sourceKey) normalized.sourceKey = existing.sourceKey

    await db[localTable].put(normalized)
  } catch (err) {
    // Silently ignore — full pull is always available as fallback
    console.warn('useRemoteChanges: failed to apply change', err.message)
  }
}
