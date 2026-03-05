'use client'

import { useState, useEffect } from 'react'
import { Loader2, Copy, Check, Pencil } from 'lucide-react'

export default function AdminSettingsPage() {
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOrg, setNeedsOrg] = useState(false)

  // Org creation
  const [orgName, setOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  // Edit org name
  const [editingOrgName, setEditingOrgName] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [savingOrgName, setSavingOrgName] = useState(false)

  // Copy link
  const [copied, setCopied] = useState(false)

  // Plan type
  const [savingPlanType, setSavingPlanType] = useState(false)

  const loadData = async () => {
    const res = await fetch('/api/organizations')
    const data = await res.json()

    if (!data.org) {
      setNeedsOrg(true)
      setLoading(false)
      return
    }

    setOrg(data.org)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const createOrg = async (e) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setCreatingOrg(true)

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName }),
    })

    if (res.ok) {
      setNeedsOrg(false)
      loadData()
    }
    setCreatingOrg(false)
  }

  const updateOrgName = async () => {
    if (!newOrgName.trim()) return
    setSavingOrgName(true)

    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName }),
    })

    if (res.ok) {
      const data = await res.json()
      setOrg(data.org)
      setEditingOrgName(false)
    }
    setSavingOrgName(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${org.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updatePlanType = async (planType) => {
    setSavingPlanType(true)
    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_type: planType }),
    })
    if (res.ok) {
      const data = await res.json()
      setOrg(data.org)
    }
    setSavingPlanType(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Create station prompt
  if (needsOrg) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Set up your station</h1>
        <p className="text-sm text-gray-500 mb-6">Create your fuel station to start managing staff and reports.</p>
        <form onSubmit={createOrg} className="space-y-4">
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Station name (e.g. MRS Lekki Phase 1)"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={creatingOrg}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            {creatingOrg && <Loader2 className="w-4 h-4 animate-spin" />}
            Create station
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Station name */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Station Name</h2>
        {editingOrgName ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              maxLength={100}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button onClick={updateOrgName} disabled={savingOrgName} className="px-3 py-2 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 disabled:opacity-50">
              {savingOrgName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
            <button onClick={() => setEditingOrgName(false)} className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900 font-medium">{org.name}</span>
            <button onClick={() => { setNewOrgName(org.name); setEditingOrgName(true) }} className="p-1 text-gray-400 hover:text-gray-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Invite link */}
      <div className="mb-8 border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Staff Invite Link</h2>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 font-mono truncate">
            {typeof window !== 'undefined' ? `${window.location.origin}/join/${org.slug}` : `/join/${org.slug}`}
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Share this link with staff to let them sign up for your station.</p>
      </div>

      {/* Plan Type */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Plan Type</h2>
        <p className="text-xs text-gray-500 mb-3">How staff pay for access.</p>
        <div className="flex gap-3">
          {[
            { value: 'recurring', label: 'Recurring', desc: 'Monthly subscription' },
            { value: 'one_time', label: 'One-time', desc: 'Single payment' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => updatePlanType(opt.value)}
              disabled={savingPlanType}
              className={`flex-1 border rounded-md p-3 text-left transition-colors ${
                org.plan_type === opt.value
                  ? 'border-orange-600 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-sm font-medium ${org.plan_type === opt.value ? 'text-orange-700' : 'text-gray-900'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
