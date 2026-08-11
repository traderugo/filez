'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT, AUTH_LINK } from '../authStyles'

const ERROR_MESSAGES = {
  callback_failed: 'Email verification failed. Please try again or request a new link.',
  verification_failed: 'Email verification link is invalid or expired. Please request a new one.',
  missing_token: 'Invalid verification link. Please request a new one.',
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimmedEmail = email.trim().toLowerCase()

    // Try Supabase auth first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (!signInError) {
      const next = searchParams.get('next') || '/dashboard'
      router.push(next)
      return
    }

    // If sign-in failed, try migrating legacy password
    const migrateRes = await fetch('/api/auth/migrate-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    })

    if (migrateRes.ok) {
      // Password migrated — retry sign-in
      const { error: retryError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (!retryError) {
        const next = searchParams.get('next') || '/dashboard'
        router.push(next)
        return
      }

      setError('Login failed after migration. Please try again.')
      setLoading(false)
      return
    }

    // Both failed — show error
    const migrateData = await migrateRes.json().catch(() => ({}))
    if (migrateRes.status === 429) {
      setError(migrateData.error || 'Too many attempts. Try again later.')
    } else {
      setError('Invalid email or password')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
        <h1 className="text-2xl font-bold text-content">Welcome back</h1>
        <p className="text-sm text-content-muted mt-1">Sign in with your email and password</p>
      </div>

      {urlError && ERROR_MESSAGES[urlError] && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-3 mb-4 text-sm text-red-800 dark:text-red-200">
          {ERROR_MESSAGES[urlError]}
        </div>
      )}

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

        <div>
          <label className={LABEL}>Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
          Sign in
        </button>
      </form>

      <p className="text-center text-sm text-content-muted mt-6">
        <Link href="/auth/forgot-password" className={AUTH_LINK}>Forgot password?</Link>
      </p>

      <p className="text-center text-sm text-content-muted mt-3">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className={AUTH_LINK}>Sign up</Link>
      </p>

      <p className="text-center text-xs text-content-faint mt-3">
        Admin?{' '}
        <Link href="/auth/admin-login" className={AUTH_LINK}>Use magic link</Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
