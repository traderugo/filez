'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import Footer from './Footer'
import EmailVerifyBanner from './EmailVerifyBanner'
import { supabase } from '@/lib/supabaseClient'

export default function AppShell({ children }) {
  const [user, setUser] = useState(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      const data = await res.json()
      setUser(data.user)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  const isAuth = pathname.startsWith('/auth')
  const isHome = pathname === '/'
  const isAdmin = pathname.startsWith('/admin')
  const isChat = pathname.endsWith('/chat')

  // Auth pages + homepage: no shell, just content
  if (isAuth || isHome) return <>{children}</>

  // Admin pages: header only, no main sidebar (admin layout has its own)
  if (isAdmin) return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}><Header /></Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}><Header /></Suspense>
      {user && !user.email_verified && pathname === '/dashboard' && <EmailVerifyBanner />}
      <main className="flex-1">{children}</main>
      {!isChat && <Footer />}
    </div>
  )
}
