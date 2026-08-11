'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import StationSidebar from './StationSidebar'

import NavigationLoader from './NavigationLoader'
import { supabase } from '@/lib/supabaseClient'

export default function AppShell({ children }) {
  const [user, setUser] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
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
      // Caches left behind by the old worker. Until the runtimeCaching fix in
      // next.config.mjs, a top-level `runtimeCaching` key was silently ignored and the
      // worker ran next-pwa's default cache, which stored page documents, RSC payloads and
      // API responses. The new worker never reads these, so every existing install is
      // carrying dead weight (and a stale copy of the app) until they are removed.
      // Safe to drop this list once the fix has been live long enough for everyone to
      // have loaded the app at least once.
      for (const name of ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'next-data', 'others']) {
        caches.delete(name).catch(() => {})
      }
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

  // Station pages: sidebar column + content column. The sidebar is `shrink-0` and lives in
  // normal flow, so this has to be a row, and the content column needs min-w-0 or a wide
  // report table pushes the sidebar off screen instead of scrolling inside its own column.
  // StationSidebar reads useSearchParams, so it gets the same Suspense boundary as Header.
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <StationSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </Suspense>
      <div className="flex flex-col flex-1 min-w-0">
        <Suspense fallback={null}><NavigationLoader /></Suspense>
        <Suspense fallback={null}><Header onMenu={() => setDrawerOpen(true)} /></Suspense>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
