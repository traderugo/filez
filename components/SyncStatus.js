'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { RefreshCw, Check, Cloud, Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { processQueue } from '@/lib/sync'
import { initialSync } from '@/lib/initialSync'
import { OUTLINE } from '@/components/ui'

export default function SyncStatus({ orgId }) {
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const pendingCount = useLiveQuery(
    () => orgId ? db.syncQueue.where('orgId').equals(orgId).count() : 0,
    [orgId],
    0
  )

  const totalPending = useLiveQuery(
    () => db.syncQueue.count(),
    [],
    0
  )

  const count = orgId ? pendingCount : totalPending
  const allSynced = count === 0

  const handleSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await processQueue()
    } catch (e) {
      console.error('[SyncStatus] Sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleRefresh = async () => {
    if (refreshing || !orgId) return
    setRefreshing(true)
    try {
      await initialSync(orgId, { force: true })
    } catch (e) {
      console.error('[SyncStatus] Refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className={`flex items-center justify-between p-3 border ${allSynced ? 'border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/40' : 'border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-950/40'}`}>
      <div className="flex items-center gap-2">
        {allSynced ? (
          <>
            <Check className="w-4 h-4 text-green-600 dark:text-green-300" />
            <span className="text-sm text-green-800 dark:text-green-200 font-medium">All synced</span>
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              {count} {count === 1 ? 'change' : 'changes'} pending
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!allSynced && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-900/50 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
            Sync now
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh data
        </button>
      </div>
    </div>
  )
}
