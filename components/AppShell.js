'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import EmailVerifyBanner from './EmailVerifyBanner'
import { supabase } from '@/lib/supabaseClient'

export default function AppShell({ children }) {
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

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
      <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <main className="flex-1">{children}</main>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={user}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSignOut={handleSignOut}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
        />
        {user && !user.email_verified && pathname === '/dashboard' && <EmailVerifyBanner />}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
