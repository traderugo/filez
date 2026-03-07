'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search, KeyRound, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { format } from 'date-fns'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  // PIN reset
  const [resetPin, setResetPin] = useState(null)
  const [resettingPin, setResettingPin] = useState(false)
  const [pinCopied, setPinCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('users')
        .select('*, subscriptions(status, end_date)')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
      setUsers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const [customData, setCustomData] = useState([])

  const handleResetPin = async (userId) => {
    if (!confirm('Reset this user\'s PIN? They will need the new PIN to log in.')) return
    setResettingPin(true)
    setResetPin(null)
    const res = await fetch('/api/admin/users/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    setResettingPin(false)
    if (res.ok) setResetPin(data.pin)
  }

  const copyResetPin = () => {
    navigator.clipboard.writeText(resetPin)
    setPinCopied(true)
    setTimeout(() => setPinCopied(false), 2000)
  }

  const selectUser = async (user) => {
    setSelectedUser(user)
    setResetPin(null)
    const fieldValuesData = await supabase
      .from('user_field_values')
      .select('value, org_custom_fields(field_name)')
      .eq('user_id', user.id)
    setCustomData(
      (fieldValuesData.data || []).map((fv) => ({
        label: fv.org_custom_fields?.field_name || 'Field',
        value: fv.value,
      }))
    )
  }

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const getLatestSub = (user) => {
    if (!user.subscriptions?.length) return null
    return user.subscriptions.sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''))[0]
  }

  if (selectedUser) {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => setSelectedUser(null)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Back to users
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">{selectedUser.name}</h1>
        <p className="text-sm text-gray-500 mb-4">{selectedUser.email}</p>
        {selectedUser.phone && <p className="text-sm text-gray-500 mb-4">{selectedUser.phone}</p>}

        {/* Reset PIN */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => handleResetPin(selectedUser.id)}
            disabled={resettingPin}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {resettingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Reset PIN
          </button>
          {resetPin && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-1.5">
              <span className="font-mono font-bold text-green-800 tracking-widest">{resetPin}</span>
              <button onClick={copyResetPin} className="text-green-600 hover:text-green-800">
                <Copy className="w-4 h-4" />
              </button>
              {pinCopied && <span className="text-xs text-green-600">Copied!</span>}
            </div>
          )}
        </div>

        {/* Custom field values */}
        {customData.length > 0 && (
          <div className="border-t border-gray-200 pt-6 space-y-1">
            {customData.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-gray-500">{item.label}:</span>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Staff</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search staff..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No staff found.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((user) => {
            const latestSub = getLatestSub(user)
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-4 px-4 cursor-pointer transition-colors"
                onClick={() => selectUser(user)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                {latestSub && <SubscriptionBadge status={latestSub.status} />}
                <span className="text-xs text-gray-400">{format(new Date(user.created_at), 'MMM d')}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
