'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ShieldX } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'
import WhatsAppSupport from '@/components/WhatsAppSupport'

export default function PendingVerificationPage() {
  const router = useRouter()
  // Read after mount: this renders on the server too, where there is no session. Used only to
  // put the account's own details into the WhatsApp message, so whoever receives it does not
  // have to ask who is writing.
  const [me, setMe] = useState(null)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user || null))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20 text-center">
      <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
      <ShieldX className="w-12 h-12 text-amber-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-content mb-3">Pending verification</h1>
      <p className="text-sm text-content-muted mb-6">
        Your account has been created but is not yet verified. Send us a message and we will
        get it approved.
      </p>

      {/* The whole point of this screen. It used to say "contact your administrator" and give
          no way to do it, so anyone landing here was stuck with nothing to click. */}
      <WhatsAppSupport
        className="mb-8"
        message={me
          ? `Hello, I signed up for StationMGR as ${me.name || 'a new user'} (${me.email}) and my account is pending verification.`
          : 'Hello, I signed up for StationMGR and my account is pending verification.'}
      />

      <br />
      <button
        onClick={handleLogout}
        className="text-sm text-content-muted hover:text-content-strong underline"
      >
        Sign out
      </button>
    </div>
  )
}
