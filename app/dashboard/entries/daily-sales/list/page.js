'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { dailySalesRepo } from '@/lib/repositories/dailySales'
import Modal from '@/components/Modal'
import { fmtDate } from '@/lib/formatDate'

export default function DailySalesListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [page, setPage] = useState(1)
  const [ready, setReady] = useState(false)
  // Clearing a day is destructive and cannot be undone, so it is confirmed against the date
  // and the number of entries rather than a bare "are you sure".
  const [confirmDay, setConfirmDay] = useState(null) // { date, count }
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const limit = 10

  useEffect(() => {
    setReady(true)
  }, [orgId])

  const allEntries = useLiveQuery(
    () => ready && orgId
      ? db.dailySales.where('orgId').equals(orgId).reverse().sortBy('entryDate')
      : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('dailySales').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || entry.entry_date || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({ date, entries }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  const deleteDay = async () => {
    if (!confirmDay) return
    setDeleting(true)
    setError('')
    try {
      await dailySalesRepo.removeByDate(orgId, confirmDay.date)
      setConfirmDay(null)
    } catch (err) {
      // Surfaced rather than swallowed: a half-deleted day is worth knowing about.
      setError(`Could not delete: ${err?.message || err}`)
    }
    setDeleting(false)
  }

  if (!ready) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-end mb-6">
        <Link href={`/dashboard/entries/daily-sales?${qs}`} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Entry
        </Link>
      </div>

      {pageGroups.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No entries yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {pageGroups.map((group) => {
              const first = group.entries[0]
              const prices = first?.prices || {}
              const hasUnsynced = group.entries.some(e => pendingIds.has(e.id))
              return (
                <div key={group.date} className={`py-3 px-2 flex items-center gap-3 ${hasUnsynced ? 'bg-green-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {group.date !== 'no-date' ? fmtDate(group.date) : 'No date'}
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {prices.PMS ? `PMS ₦${Number(prices.PMS).toLocaleString()}` : ''}
                      {prices.AGO ? `${prices.PMS ? ' · ' : ''}AGO ₦${Number(prices.AGO).toLocaleString()}` : ''}
                      {prices.DPK ? `${prices.PMS || prices.AGO ? ' · ' : ''}DPK ₦${Number(prices.DPK).toLocaleString()}` : ''}
                      {group.entries.some(e => e.closeOfBusiness || e.close_of_business) && <span className="ml-1 text-green-600 font-medium">(COB)</span>}
                    </p>
                  </div>
                  <Link href={`/dashboard/entries/daily-sales?${qs}&edit_date=${group.date}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Link>
                  {group.date !== 'no-date' && (
                    <button
                      onClick={() => setConfirmDay({ date: group.date, count: group.entries.length })}
                      title="Delete every entry for this day"
                      className="flex items-center gap-1 text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}

      <Modal open={!!confirmDay} onClose={() => (deleting ? null : setConfirmDay(null))} title="Delete this day?">
        <p className="text-sm text-gray-600 mb-2">
          This removes all {confirmDay?.count} {confirmDay?.count === 1 ? 'entry' : 'entries'} for{' '}
          <span className="font-medium text-gray-900">{confirmDay ? fmtDate(confirmDay.date) : ''}</span>, so the day can be entered again from scratch.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          It cannot be undone. Other records for this date — lodgements, receipts, lube — are not touched.
        </p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmDay(null)}
            disabled={deleting}
            className="flex-1 border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={deleteDay}
            disabled={deleting}
            className="flex-1 bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete day'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
