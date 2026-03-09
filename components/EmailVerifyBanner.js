'use client'

import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function EmailVerifyBanner() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResend = async () => {
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      })
    }
    setSending(false)
    setSent(true)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-sm">
      <Mail className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="flex-1 text-amber-800">
        <strong>Verify your email</strong> to secure your account and enable password recovery.
        {sent ? (
          <span className="text-green-700 ml-1">Verification email sent!</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-amber-700 underline hover:text-amber-900 ml-1 inline-flex items-center gap-1"
          >
            {sending && <Loader2 className="w-3 h-3 animate-spin" />}
            Send verification email
          </button>
        )}
      </p>
    </div>
  )
}
