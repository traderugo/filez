'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT, AUTH_LINK } from '../authStyles'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password` }
    )

    setLoading(false)

    if (resetError) {
      setError(resetError.message || 'Failed to send reset email')
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20">
        <div className="text-center mb-8">
          <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
          <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-content">Check your email</h1>
          <p className="text-sm text-content-muted mt-2">
            We sent a password reset link to <strong>{email}</strong>.
            Click the link in the email to set a new password.
          </p>
        </div>

        <p className="text-center text-sm text-content-muted">
          <Link href="/auth/login" className={AUTH_LINK}>Back to login</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
        <h1 className="text-2xl font-bold text-content">Reset your password</h1>
        <p className="text-sm text-content-muted mt-1">Enter your email and we&apos;ll send you a reset link</p>
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
              placeholder="you@example.com"
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
          Send reset link
        </button>
      </form>

      <p className="text-center text-sm text-content-muted mt-6">
        <Link href="/auth/login" className={AUTH_LINK}>Back to login</Link>
      </p>
    </div>
  )
}
