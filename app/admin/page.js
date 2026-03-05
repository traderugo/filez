'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, X, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { format } from 'date-fns'

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [expandedId, setExpandedId] = useState(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(null)

  const loadSubs = async () => {
    let query = supabase
      .from('subscriptions')
      .select('id, status, created_at, payment_reference, proof_url, notes, start_date, end_date, users(name, email, phone)')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setSubs(data || [])
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    loadSubs()
  }, [filter])

  const handleAction = async (sub, action) => {
    setActing(sub.id)
    const today = new Date()
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 1)

    const updates = action === 'approve'
      ? {
          status: 'active',
          start_date: today.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          notes: notes || null,
        }
      : {
          status: 'revoked',
          notes: notes || 'Rejected by admin',
        }

    await supabase.from('subscriptions').update(updates).eq('id', sub.id)
    setActing(null)
    setExpandedId(null)
    setNotes('')
    loadSubs()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Subscriptions</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {['pending', 'active', 'expired', 'revoked', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              filter === f
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No {filter} subscriptions.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {subs.map((sub) => (
            <div key={sub.id} className="py-3">
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4 py-2 transition-colors"
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{sub.users?.name}</p>
                  <p className="text-xs text-gray-500">{sub.users?.email}</p>
                </div>
                <SubscriptionBadge status={sub.status} />
                <span className="text-xs text-gray-400">{format(new Date(sub.created_at), 'MMM d')}</span>
                {expandedId === sub.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>

              {expandedId === sub.id && (
                <div className="mt-2 ml-0 space-y-3 px-4 pb-2">
                  <div className="space-y-1 text-sm">
                    {sub.payment_reference && (
                      <div className="flex gap-2">
                        <span className="text-gray-500">Ref:</span>
                        <span className="text-gray-900 font-mono">{sub.payment_reference}</span>
                      </div>
                    )}
                    {sub.users?.phone && (
                      <div className="flex gap-2">
                        <span className="text-gray-500">Phone:</span>
                        <span className="text-gray-900">{sub.users.phone}</span>
                      </div>
                    )}
                    {sub.start_date && (
                      <div className="flex gap-2">
                        <span className="text-gray-500">Period:</span>
                        <span className="text-gray-900">
                          {format(new Date(sub.start_date), 'MMM d')} — {format(new Date(sub.end_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    {sub.notes && (
                      <div className="flex gap-2">
                        <span className="text-gray-500">Notes:</span>
                        <span className="text-gray-900">{sub.notes}</span>
                      </div>
                    )}
                  </div>

                  {sub.proof_url && sub.proof_url.startsWith('https://') && (
                    <a
                      href={sub.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline"
                    >
                      <Eye className="w-4 h-4" /> View proof
                    </a>
                  )}

                  {sub.status === 'pending' && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(sub, 'approve')}
                          disabled={acting === sub.id}
                          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {acting === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(sub, 'reject')}
                          disabled={acting === sub.id}
                          className="flex items-center gap-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
