'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Fuel, Mail, Lock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

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
        <Fuel className="w-8 h-8 text-blue-600 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in with your email and password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign in
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">Forgot password?</Link>
      </p>

      <p className="text-center text-sm text-gray-500 mt-3">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-blue-600 hover:underline">Sign up</Link>
      </p>

      <p className="text-center text-xs text-gray-400 mt-3">
        Admin?{' '}
        <Link href="/auth/admin-login" className="text-blue-600 hover:underline">Use magic link</Link>
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
