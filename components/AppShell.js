'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'

export default function AppShell({ children }) {
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
    await fetch('/api/auth/pin-logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  const isAuth = pathname.startsWith('/auth')

  // Auth pages: no shell, just content
  if (isAuth) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSignOut={handleSignOut}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
