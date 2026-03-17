'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ShieldX } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function PendingVerificationPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20 text-center">
      <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
      <ShieldX className="w-12 h-12 text-amber-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Pending verification</h1>
      <p className="text-sm text-gray-500 mb-8">
        Your account has been created but is not yet verified.
        Please contact your administrator to get your account approved.
      </p>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Sign out
      </button>
    </div>
  )
}
