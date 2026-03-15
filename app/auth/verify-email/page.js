'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  const handleResend = async () => {
    if (!email) {
      setError('Email not found. Please sign up again.')
      return
    }

    setResending(true)
    setError('')
    setResent(false)

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    setResending(false)

    if (resendError) {
      setError('Could not resend email. Please try signing up again.')
      return
    }

    setResent(true)
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
        <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="text-sm text-gray-500 mt-2">
          We sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}.
          Click the link to activate your account.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 mb-6">
        <p className="font-medium mb-1">What to do:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Open your email inbox</li>
          <li>Find the email from us (check spam too)</li>
          <li>Click the verification link</li>
          <li>Come back here and log in</li>
        </ol>
      </div>

      {resent && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-3 mb-4">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Verification email resent!
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        onClick={handleResend}
        disabled={resending || !email}
        className="w-full border border-gray-300 text-gray-700 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
      >
        {resending && <Loader2 className="w-4 h-4 animate-spin" />}
        Resend verification email
      </button>

      <p className="text-center text-sm text-gray-500">
        Already verified?{' '}
        <Link href="/auth/login" className="text-blue-600 hover:underline">Log in</Link>
      </p>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
