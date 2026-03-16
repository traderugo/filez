'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { db } from '@/lib/db'

export default function LubeListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [tab, setTab] = useState('sales')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [orgId])

  const hasConfig = useLiveQuery(
    () => ready && orgId ? db.lubeProducts.where('orgId').equals(orgId).count() : 0,
    [orgId, ready], 0
  )

  if (!ready) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" /></div>

  if (hasConfig === 0) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Lube Management service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Lube Entries</h1>
        <Link href={`/dashboard/entries/lube?${qs}&type=${tab}`} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Entry
        </Link>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setTab('sales')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Lube Sales
        </button>
        <button onClick={() => setTab('stock')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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

  if (pageGroups.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No sales entries yet.</p>

  return (
    <>
      <div className="divide-y divide-gray-100">
        {pageGroups.map((group) => (
          <div key={group.date} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {group.date !== 'no-date' ? format(new Date(group.date + 'T00:00:00'), 'MMM d, yyyy') : 'No date'}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
              </p>
              <p className="text-xs text-gray-500">
                {group.entries.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ' · '}
                    {productsMap[e.productId] || 'Unknown'} sold:{e.unitSold} recv:{e.unitReceived}
                  </span>
                ))}
              </p>
            </div>
            <Link href={`/dashboard/entries/lube?${qs}&type=sales&edit_date=${group.date}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
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

  if (pageGroups.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No stock entries yet.</p>

  return (
    <>
      <div className="divide-y divide-gray-100">
        {pageGroups.map((group) => (
          <div key={group.date} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {group.date !== 'no-date' ? format(new Date(group.date + 'T00:00:00'), 'MMM d, yyyy') : 'No date'}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
              </p>
              <p className="text-xs text-gray-500">
                {group.entries.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ' · '}
                    {productsMap[e.productId] || 'Unknown'} stock:{Number(e.stock).toLocaleString()}
                  </span>
                ))}
              </p>
            </div>
            <Link href={`/dashboard/entries/lube?${qs}&type=stock&edit_date=${group.date}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </>
  )
}
