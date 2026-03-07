'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Fuel, LogOut, Menu, X, LayoutDashboard, Shield } from 'lucide-react'

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

  const handleSignOut = async () => {
    await fetch('/api/auth/pin-logout', { method: 'POST' })
    setUser(null)
    setMenuOpen(false)
    router.push('/')
  }

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg">
          <Fuel className="w-5 h-5 text-orange-600" />
          StationVA
        </Link>

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
              <Link href="/auth/register" className="bg-orange-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-orange-700">
                Sign up
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button className="sm:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2">
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-gray-700">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-gray-700">
                  <Shield className="w-4 h-4" /> Admin
                </Link>
              )}
              <button onClick={handleSignOut} className="flex items-center gap-2 py-2 text-gray-700 w-full text-left">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">Log in</Link>
              <Link href="/auth/register" onClick={() => setMenuOpen(false)} className="block py-2 text-orange-600 font-medium">Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
