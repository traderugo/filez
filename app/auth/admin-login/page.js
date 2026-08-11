'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, Mail, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT, AUTH_LINK } from '../authStyles'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 dark:text-green-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-content mb-2">Check your email</h1>
        <p className="text-content-muted text-sm">
          We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <Shield className="w-8 h-8 text-primary-600 dark:text-primary-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-content">Admin Login</h1>
        <p className="text-sm text-content-muted mt-1">Sign in with magic link</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={LABEL}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${AUTH_SUBMIT}`}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Send magic link
        </button>
      </form>

      <p className="text-center text-sm text-content-muted mt-6">
        Not an admin?{' '}
        <Link href="/auth/login" className={AUTH_LINK}>User login</Link>
      </p>
    </div>
  )
}
