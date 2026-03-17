'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search, KeyRound, Copy, ShieldCheck, ShieldX, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, verified, unverified
  const [selectedUser, setSelectedUser] = useState(null)

  // PIN reset
  const [resetPin, setResetPin] = useState(null)
  const [resettingPin, setResettingPin] = useState(false)
  const [pinCopied, setPinCopied] = useState(false)

  // Verify
  const [verifying, setVerifying] = useState(false)

  const [customData, setCustomData] = useState([])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, phone, role, email_verified, created_at, org_id')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

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

  const handleVerify = async (userId, verified) => {
    setVerifying(true)
    const res = await fetch('/api/admin/users/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, verified }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, email_verified: verified } : u))
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => ({ ...prev, email_verified: verified }))
      }
    }
    setVerifying(false)
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

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    if (filter === 'verified') return matchesSearch && u.email_verified
    if (filter === 'unverified') return matchesSearch && !u.email_verified
    return matchesSearch
  })

  const unverifiedCount = users.filter(u => !u.email_verified).length

  if (selectedUser) {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => setSelectedUser(null)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          &larr; Back to users
        </button>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedUser.name}</h1>
            <p className="text-sm text-gray-500">{selectedUser.email}</p>
            {selectedUser.phone && <p className="text-sm text-gray-500">{selectedUser.phone}</p>}
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            selectedUser.email_verified
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {selectedUser.email_verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
            {selectedUser.email_verified ? 'Verified' : 'Unverified'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mb-6">
          {selectedUser.email_verified ? (
            <button
              onClick={() => handleVerify(selectedUser.id, false)}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
              Revoke verification
            </button>
          ) : (
            <button
              onClick={() => handleVerify(selectedUser.id, true)}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify user
            </button>
          )}

          <button
            onClick={() => handleResetPin(selectedUser.id)}
            disabled={resettingPin}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {resettingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Reset PIN
          </button>
        </div>

        {resetPin && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-2 mb-6 w-fit">
            <span className="text-sm text-green-800">New PIN:</span>
            <span className="font-mono font-bold text-green-800 tracking-widest">{resetPin}</span>
            <button onClick={copyResetPin} className="text-green-600 hover:text-green-800">
              <Copy className="w-4 h-4" />
            </button>
            {pinCopied && <span className="text-xs text-green-600">Copied!</span>}
          </div>
        )}

        {/* Details */}
        <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-500">Role:</span>
            <span className="text-gray-900">{selectedUser.role}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500">Joined:</span>
            <span className="text-gray-900">{format(new Date(selectedUser.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>

        {/* Custom field values */}
        {customData.length > 0 && (
          <div className="border-t border-gray-200 pt-4 mt-4 space-y-1">
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        {unverifiedCount > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            {unverifiedCount} pending
          </span>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No users found.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-4 px-4 cursor-pointer transition-colors"
              onClick={() => selectUser(user)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'No name'}</p>
                  {!user.email_verified && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                      PENDING
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <span className="text-xs text-gray-400">{format(new Date(user.created_at), 'MMM d')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
