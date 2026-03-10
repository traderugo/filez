'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, CreditCard,
  MessageSquare, Shield, LogOut, X, ChevronLeft, ChevronRight
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/subscribe', label: 'Subscribe', icon: CreditCard },
  { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquare },
]

export default function Sidebar({ user, open, collapsed, onClose, onToggleCollapse, onSignOut }) {
  const pathname = usePathname()

  const isActive = (href, exact) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 sm:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen bg-white border-r border-gray-200
        flex flex-col flex-shrink-0 overflow-y-auto overflow-x-hidden
        transition-all duration-200 ease-in-out
        sm:sticky sm:top-0 sm:z-auto
        ${open ? 'translate-x-0 w-60' : '-translate-x-full w-60'}
        ${collapsed ? 'sm:translate-x-0 sm:w-16' : 'sm:translate-x-0 sm:w-60'}
      `}>
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-gray-100 ${collapsed ? 'sm:justify-center sm:px-0 px-4' : 'px-4 justify-between'}`}>
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-900 font-bold text-lg whitespace-nowrap"
            onClick={onClose}
          >
            <Image src="/stationva-logo.svg" alt="StationVA" width={28} height={28} className="rounded flex-shrink-0" />
            <span className={collapsed ? 'sm:hidden' : ''}>{collapsed ? '' : 'StationVA'}</span>
          </Link>
          <button className="hidden sm:block p-1 text-gray-400 hover:text-gray-600" onClick={onToggleCollapse}>
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button className="sm:hidden p-1 text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'sm:px-2 px-3' : 'px-3'}`}>
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-md text-sm ${
                collapsed
                  ? `sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2`
                  : 'gap-3 px-3 py-2'
              } ${
                isActive(href, exact)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={collapsed ? 'sm:hidden' : ''}>{label}</span>
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              onClick={onClose}
              title={collapsed ? 'Admin' : undefined}
              className={`flex items-center rounded-md text-sm ${
                collapsed
                  ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                  : 'gap-3 px-3 py-2'
              } ${
                pathname.startsWith('/admin')
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span className={collapsed ? 'sm:hidden' : ''}>Admin</span>
            </Link>
          )}
        </nav>

        {/* User / Logout */}
        {user && (
          <div className={`py-4 border-t border-gray-100 ${collapsed ? 'sm:px-2 px-3' : 'px-3'}`}>
            {!collapsed && (
              <p className="px-3 text-xs text-gray-400 truncate mb-2">{user.name || user.email || 'User'}</p>
            )}
            <button
              onClick={() => { onSignOut(); onClose() }}
              title={collapsed ? 'Sign out' : undefined}
              className={`flex items-center rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full ${
                collapsed
                  ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                  : 'gap-3 px-3 py-2'
              }`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={collapsed ? 'sm:hidden' : ''}>Sign out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
