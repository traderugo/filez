'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Fuel, LogOut, Menu, X, LayoutDashboard, Shield, ChevronLeft } from 'lucide-react'

// Map sub-page paths to { back, title }
const PAGE_MAP = {
  '/dashboard/entries/daily-sales': { back: '/dashboard/entries', title: 'Daily Sales' },
  '/dashboard/entries/product-receipt': { back: '/dashboard/entries', title: 'Product Receipt' },
  '/dashboard/entries/lodgements': { back: '/dashboard/entries', title: 'Lodgements' },
  '/dashboard/entries/lube': { back: '/dashboard/entries', title: 'Lube' },
  '/dashboard/entries/customer-payments': { back: '/dashboard/entries', title: 'Customer Payments' },
  '/dashboard/entries': { back: '/dashboard', title: 'Entries' },
  '/dashboard/subscribe': { back: '/dashboard', title: 'Subscribe' },
  '/dashboard/feedback': { back: '/dashboard', title: 'Feedback' },
}

function getPageInfo(pathname) {
  // Exact match first
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]

  // Dynamic station settings: /dashboard/stations/[id]/settings
  const settingsMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/settings$/)
  if (settingsMatch) return { back: `/dashboard/stations/${settingsMatch[1]}`, title: 'Settings' }

  // Dynamic station page: /dashboard/stations/[id]
  const stationMatch = pathname.match(/^\/dashboard\/stations\/[^/]+$/)
  if (stationMatch) return { back: '/dashboard', title: 'Station' }

  // Dynamic setup page: /dashboard/setup/[id]
  const setupMatch = pathname.match(/^\/dashboard\/setup\/[^/]+$/)
  if (setupMatch) return { back: '/dashboard', title: 'Setup' }

  return null
}

export default function Header() {
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
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

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const handleSignOut = async () => {
    await fetch('/api/auth/pin-logout', { method: 'POST' })
    setUser(null)
    setMenuOpen(false)
    router.push('/')
  }

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const pageInfo = getPageInfo(pathname)

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Left side: back button or logo */}
        {pageInfo ? (
          <button onClick={() => router.push(pageInfo.back)} className="flex items-center gap-1 text-gray-700 hover:text-gray-900 -ml-1">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">{pageInfo.title}</span>
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg">
            <Fuel className="w-5 h-5 text-blue-600" />
            StationVA
          </Link>
        )}

        {/* Right side */}
        {pageInfo ? (
          /* Minimal right side on sub-pages */
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400 hidden sm:inline">{user.name || 'User'}</span>
            )}
          </div>
        ) : (
          <>
            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                    Dashboard
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                      Admin
                    </Link>
                  )}
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{user.name || 'User'}</span>
                  <button onClick={handleSignOut} className="text-gray-500 hover:text-gray-900">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">Log in</Link>
                  <Link href="/auth/register" className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700">
                    Sign up
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile hamburger */}
            <button className="sm:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && !pageInfo && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2">
          {user ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-2 py-2 text-gray-700">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin" className="flex items-center gap-2 py-2 text-gray-700">
                  <Shield className="w-4 h-4" /> Admin
                </Link>
              )}
              <button onClick={handleSignOut} className="flex items-center gap-2 py-2 text-gray-700 w-full text-left">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="block py-2 text-gray-700">Log in</Link>
              <Link href="/auth/register" className="block py-2 text-blue-600 font-medium">Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
