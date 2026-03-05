'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, GripVertical, Copy, Check, Pencil, X, Link as LinkIcon } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSettingsPage() {
  const [org, setOrg] = useState(null)
  const [fields, setFields] = useState([])
  const [services, setServices] = useState([])
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

  // Field form
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [fieldForm, setFieldForm] = useState({ field_name: '', field_type: 'text', options: '', required: false })
  const [savingField, setSavingField] = useState(false)

  // Service form
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceForm, setServiceForm] = useState({ name: '', description: '' })
  const [savingService, setSavingService] = useState(false)

  const loadData = async () => {
    const res = await fetch('/api/organizations')
    const data = await res.json()

    if (!data.org) {
      setNeedsOrg(true)
      setLoading(false)
      return
    }

    setOrg(data.org)

    const [fieldsRes, servicesRes] = await Promise.all([
      fetch(`/api/organizations/fields?org_id=${data.org.id}`).then((r) => r.json()),
      fetch(`/api/organizations/services?org_id=${data.org.id}`).then((r) => r.json()),
    ])

    setFields(fieldsRes.fields || [])
    setServices(servicesRes.services || [])
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

  const addField = async (e) => {
    e.preventDefault()
    setSavingField(true)

    const body = {
      field_name: fieldForm.field_name,
      field_type: fieldForm.field_type,
      required: fieldForm.required,
    }

    if (fieldForm.field_type === 'select') {
      body.options = fieldForm.options.split(',').map((o) => o.trim()).filter(Boolean)
    }

    const res = await fetch('/api/organizations/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setFieldForm({ field_name: '', field_type: 'text', options: '', required: false })
      setShowFieldForm(false)
      loadData()
    }
    setSavingField(false)
  }

  const deleteField = async (id) => {
    if (!confirm('Delete this field? User responses will be lost.')) return
    await fetch('/api/organizations/fields', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadData()
  }

  const addService = async (e) => {
    e.preventDefault()
    setSavingService(true)

    const res = await fetch('/api/organizations/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceForm),
    })

    if (res.ok) {
      setServiceForm({ name: '', description: '' })
      setShowServiceForm(false)
      loadData()
    }
    setSavingService(false)
  }

  const deleteService = async (id) => {
    if (!confirm('Delete this service?')) return
    await fetch('/api/organizations/services', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadData()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Create org prompt
  if (needsOrg) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Create your organization</h1>
        <p className="text-sm text-gray-500 mb-6">Set up your business to start inviting users.</p>
        <form onSubmit={createOrg} className="space-y-4">
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Organization name"
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
            Create organization
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Organization name */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Organization</h2>
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
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Invite Link</h2>
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
        <p className="text-xs text-gray-500 mt-2">Share this link with users to let them sign up for your organization.</p>
      </div>

      {/* Custom Fields */}
      <div className="mb-8 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Custom Fields</h2>
          <button
            onClick={() => setShowFieldForm(!showFieldForm)}
            className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add field
          </button>
        </div>

        {showFieldForm && (
          <form onSubmit={addField} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Field name (e.g. Number of pumps)"
              value={fieldForm.field_name}
              onChange={(e) => setFieldForm({ ...fieldForm, field_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex gap-3">
              <select
                value={fieldForm.field_type}
                onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={fieldForm.required}
                  onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                Required
              </label>
            </div>
            {fieldForm.field_type === 'select' && (
              <input
                type="text"
                placeholder="Options (comma-separated, e.g. Small, Medium, Large)"
                value={fieldForm.options}
                onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingField}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {savingField && <Loader2 className="w-4 h-4 animate-spin" />}
                Add
              </button>
              <button type="button" onClick={() => setShowFieldForm(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">No custom fields. Users will only fill in name, email, and phone.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center gap-3 py-3">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {field.field_name}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {field.field_type}
                    {field.field_type === 'select' && field.options && ` (${field.options.join(', ')})`}
                  </p>
                </div>
                <button onClick={() => deleteField(field.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Services */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Services</h2>
          <button
            onClick={() => setShowServiceForm(!showServiceForm)}
            className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add service
          </button>
        </div>

        {showServiceForm && (
          <form onSubmit={addService} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
            <input
              type="text"
              required
              maxLength={200}
              placeholder="Service name (e.g. Monthly Pump Report)"
              value={serviceForm.name}
              onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingService}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {savingService && <Loader2 className="w-4 h-4 animate-spin" />}
                Add
              </button>
              <button type="button" onClick={() => setShowServiceForm(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        {services.length === 0 ? (
          <p className="text-sm text-gray-500">No services defined. Add services your organization offers.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {services.map((svc) => (
              <div key={svc.id} className="flex items-center gap-3 py-3">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                  {svc.description && <p className="text-xs text-gray-500">{svc.description}</p>}
                </div>
                <button onClick={() => deleteService(svc.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
