'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'

import NavigationLoader from './NavigationLoader'
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

    // Force-update stale service workers and clear old API caches
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return
        reg.update()
        const activate = (sw) => sw.postMessage({ type: 'SKIP_WAITING' })
        if (reg.waiting) activate(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const newSw = reg.installing
          if (!newSw) return
          newSw.addEventListener('statechange', () => {
            if (newSw.state === 'installed' && reg.waiting) activate(reg.waiting)
          })
        })
      })
      // Clear stale API caches from old service workers
      caches.delete('apis').catch(() => {})
    }
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
      <Suspense fallback={null}><NavigationLoader /></Suspense>
      <Suspense fallback={null}><Header /></Suspense>
      <main className="flex-1">{children}</main>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}><NavigationLoader /></Suspense>
      <Suspense fallback={null}><Header /></Suspense>
      <main className="flex-1">{children}</main>
    </div>
  )
}
