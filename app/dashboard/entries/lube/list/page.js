'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/formatDate'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { BTN_PRIMARY, BTN_FRAMED } from '@/components/ui'

export default function LubeListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [tab, setTab] = useState('sales')
  const [ready, setReady] = useState(false)
  const { subscribed, loading: subLoading } = useSubscription(orgId, 'lube-management')

  useEffect(() => {
    setReady(true)
  }, [orgId])

  if (!ready) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-line border-t-blue-600 rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      {!subLoading && !subscribed && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-4 py-3 mb-4 flex items-center gap-3">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Subscribe to add entries</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">You can view existing data, but creating new entries requires an active subscription.</p>
          </div>
          <Link href="/dashboard/subscribe" className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium ${BTN_PRIMARY}`}>Subscribe</Link>
        </div>
      )}
      <div className="flex items-center justify-end mb-6">
        {(subscribed || subLoading) ? (
          <Link href={`/dashboard/entries/lube?${qs}&type=${tab}`} className={`flex items-center gap-1 text-sm px-4 py-2 font-medium ${BTN_PRIMARY}`}>
            <Plus className="w-4 h-4" /> New Entry
          </Link>
        ) : (
          <span className="flex items-center gap-1 text-sm bg-subtle text-content-faint px-4 py-2 font-medium cursor-not-allowed">
            <Plus className="w-4 h-4" /> New Entry
          </span>
        )}
      </div>

      <div className="flex border-b border-line mb-6">
        <button onClick={() => setTab('sales')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'sales' ? 'border-blue-600 text-primary-600' : 'border-transparent text-content-muted hover:text-content-strong'}`}>
          Lube Sales
        </button>
        <button onClick={() => setTab('stock')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-blue-600 text-primary-600' : 'border-transparent text-content-muted hover:text-content-strong'}`}>
          Lube Stock
        </button>
      </div>

      {tab === 'sales' ? <LubeSalesList orgId={orgId} qs={qs} ready={ready} /> : <LubeStockList orgId={orgId} qs={qs} ready={ready} />}
    </div>
  )
}

function LubeSalesList({ orgId, qs, ready }) {
  const [page, setPage] = useState(1)
  const limit = 10

  const allEntries = useLiveQuery(
    () => ready && orgId ? db.lubeSales.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('lubeSales').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const productsMap = useLiveQuery(
    () => ready && orgId
      ? db.lubeProducts.where('orgId').equals(orgId).toArray().then(arr => Object.fromEntries(arr.map(p => [p.id, p.product_name])))
      : {},
    [orgId, ready], {}
  )

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({ date, entries }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (pageGroups.length === 0) return <p className="text-sm text-content-muted py-8 text-center">No sales entries yet.</p>

  return (
    <>
      <div className="divide-y divide-line">
        {pageGroups.map((group) => {
          const hasUnsynced = group.entries.some(e => pendingIds.has(e.id))
          return (
          <div key={group.date} className={`py-3 px-2 flex items-center gap-3 ${hasUnsynced ? 'bg-green-50 dark:bg-green-950/40' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content">
                {group.date !== 'no-date' ? fmtDate(group.date) : 'No date'}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-subtle text-content-muted font-medium">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
              </p>
              <p className="text-xs text-content-muted">
                {group.entries.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ' · '}
                    {productsMap[e.productId] || 'Unknown'} sold:{e.unitSold} recv:{e.unitReceived}
                  </span>
                ))}
              </p>
            </div>
            <Link href={`/dashboard/entries/lube?${qs}&type=sales&edit_date=${group.date}`} className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 ${BTN_FRAMED}`}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-content-muted hover:text-content disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
          <span className="text-sm text-content-muted">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-content-muted hover:text-content disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </>
  )
}

function LubeStockList({ orgId, qs, ready }) {
  const [page, setPage] = useState(1)
  const limit = 10

  const allEntries = useLiveQuery(
    () => ready && orgId ? db.lubeStock.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('lubeStock').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const productsMap = useLiveQuery(
    () => ready && orgId
      ? db.lubeProducts.where('orgId').equals(orgId).toArray().then(arr => Object.fromEntries(arr.map(p => [p.id, p.product_name])))
      : {},
    [orgId, ready], {}
  )

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({ date, entries }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (pageGroups.length === 0) return <p className="text-sm text-content-muted py-8 text-center">No stock entries yet.</p>

  return (
    <>
      <div className="divide-y divide-line">
        {pageGroups.map((group) => {
          const hasUnsynced = group.entries.some(e => pendingIds.has(e.id))
          return (
          <div key={group.date} className={`py-3 px-2 flex items-center gap-3 ${hasUnsynced ? 'bg-green-50 dark:bg-green-950/40' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content">
                {group.date !== 'no-date' ? fmtDate(group.date) : 'No date'}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-subtle text-content-muted font-medium">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
              </p>
              <p className="text-xs text-content-muted">
                {group.entries.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ' · '}
                    {productsMap[e.productId] || 'Unknown'} stock:{Number(e.stock).toLocaleString()}
                  </span>
                ))}
              </p>
            </div>
            <Link href={`/dashboard/entries/lube?${qs}&type=stock&edit_date=${group.date}`} className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 ${BTN_FRAMED}`}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-content-muted hover:text-content disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
          <span className="text-sm text-content-muted">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-content-muted hover:text-content disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </>
  )
}
