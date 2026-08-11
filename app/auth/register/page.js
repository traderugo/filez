'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Mail, Lock, User, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT, AUTH_LINK } from '../authStyles'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          phone: form.phone.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (signUpError) {
      if (signUpError.message?.includes('already registered')) {
        setError('An account with this email already exists. Please log in.')
      } else {
        setError(signUpError.message || 'Registration failed')
      }
      return
    }

    // Auto sign-in and redirect to dashboard
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    })

    if (signInError) {
      // Signup succeeded but auto-login failed — send to login page
      router.push('/auth/login')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
        <h1 className="text-2xl font-bold text-content">Create an account</h1>
        <p className="text-sm text-content-muted mt-1">Sign up to manage your station</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={LABEL}>Full name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="text"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Doe"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Phone number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="08012345678"
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
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 characters"
              className={AUTH_INPUT}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Repeat your password"
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
          Sign up
        </button>
      </form>

      <p className="text-center text-sm text-content-muted mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className={AUTH_LINK}>Log in</Link>
      </p>
    </div>
  )
}
