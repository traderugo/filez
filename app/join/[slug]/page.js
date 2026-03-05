'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function JoinPage() {
  const { slug } = useParams()
  const [org, setOrg] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [fieldValues, setFieldValues] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      // Fetch org by slug
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', slug)
        .single()

      if (!orgData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setOrg(orgData)

      // Fetch custom fields
      const { data: fieldsData } = await supabase
        .from('org_custom_fields')
        .select('*')
        .eq('org_id', orgData.id)
        .order('sort_order')

      setFields(fieldsData || [])
      setLoading(false)
    }
    load()
  }, [slug])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Validate required custom fields
    for (const field of fields) {
      if (field.required && !fieldValues[field.id]?.trim()) {
        setError(`"${field.field_name}" is required`)
        setSubmitting(false)
        return
      }
    }

    try {
      // Register user with org_id and field values
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          org_id: org.id,
          field_values: Object.entries(fieldValues)
            .filter(([, v]) => v?.trim())
            .map(([field_id, value]) => ({ field_id, value: value.trim() })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        setSubmitting(false)
        return
      }

      // Send magic link
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: form.email.toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })

      if (otpError) {
        setError('Failed to send verification email')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Not Found</h1>
        <p className="text-sm text-gray-500">This invite link is invalid or has expired.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-500">
          We sent a sign-in link to <strong>{form.email}</strong>. Click it to access your account.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Join {org.name}</h1>
      <p className="text-sm text-gray-500 mb-8">Create your account to get started.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
          <input
            type="text"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            required
            maxLength={254}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+2348012345678"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Custom fields */}
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.field_name} {field.required && '*'}
            </label>
            {field.field_type === 'select' ? (
              <select
                required={field.required}
                value={fieldValues[field.id] || ''}
                onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select...</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.field_type === 'number' ? 'number' : 'text'}
                required={field.required}
                value={fieldValues[field.id] || ''}
                onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create account
        </button>
      </form>
    </div>
  )
}
