'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Plus, Pencil, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const SALES_API = '/api/entries/lube-sales'
const STOCK_API = '/api/entries/lube-stock'

export default function LubeListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [tab, setTab] = useState('sales')
  const [locked, setLocked] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)

  useEffect(() => {
    const check = async () => {
      const res = await fetch(`${SALES_API}?page=1&limit=1&${qs}`)
      if (res.status === 403) setLocked(true)
      setCheckingAccess(false)
    }
    check()
  }, [])

  if (checkingAccess) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (locked) return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <div className="text-center py-16">
        <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Required</h2>
        <p className="text-sm text-gray-500 mb-4">Subscribe to the Lube Management service to access this feature.</p>
        <Link href="/dashboard/subscribe" className="inline-block bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">Subscribe Now</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
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

      {tab === 'sales' ? <LubeSalesList qs={qs} /> : <LubeStockList qs={qs} />}
    </div>
  )
}

function LubeSalesList({ qs }) {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const limit = 10
  const totalPages = Math.ceil(total / limit)

  const loadEntries = async (p = page) => {
    const res = await fetch(`${SALES_API}?page=${p}&limit=${limit}&${qs}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [])
  useEffect(() => { loadEntries(page) }, [page])

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (entries.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No sales entries yet.</p>

  return (
    <>
      <div className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <div key={entry.id} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {format(new Date(entry.entry_date), 'MMM d, yyyy')}
                <span className="ml-2 text-xs text-gray-600">{entry.product?.product_name || 'Unknown'}</span>
              </p>
              <p className="text-xs text-gray-500">
                {entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : ''}
                {' · '}Sold: {entry.unit_sold} · Received: {entry.unit_received} · &#8358;{Number(entry.price).toLocaleString()}
                {entry.users?.name ? ` · by ${entry.users.name}` : ''}
              </p>
            </div>
            <Link href={`/dashboard/entries/lube?${qs}&type=sales&edit=${entry.id}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">
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

function LubeStockList({ qs }) {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const limit = 10
  const totalPages = Math.ceil(total / limit)

  const loadEntries = async (p = page) => {
    const res = await fetch(`${STOCK_API}?page=${p}&limit=${limit}&${qs}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [])
  useEffect(() => { loadEntries(page) }, [page])

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  if (entries.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No stock entries yet.</p>

  return (
    <>
      <div className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <div key={entry.id} className="py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {format(new Date(entry.entry_date), 'MMM d, yyyy')}
                <span className="ml-2 text-xs text-gray-600">{entry.product?.product_name || 'Unknown'}</span>
              </p>
              <p className="text-xs text-gray-500">
                {entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : ''}
                {' · '}Stock: {Number(entry.stock).toLocaleString()}
                {entry.users?.name ? ` · by ${entry.users.name}` : ''}
              </p>
            </div>
            <Link href={`/dashboard/entries/lube?${qs}&type=stock&edit=${entry.id}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">
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
