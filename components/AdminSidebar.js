'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Users, FolderOpen, BarChart3, Settings, Fuel } from 'lucide-react'

const links = [
  { href: '/admin', label: 'Subscriptions', icon: ClipboardList },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/files', label: 'Files', icon: FolderOpen },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/station-setup', label: 'Station Setup', icon: Fuel },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible border-b sm:border-b-0 sm:border-r border-gray-200 sm:w-48 sm:min-h-[calc(100vh-3.5rem)] px-2 py-2 sm:py-4 bg-white">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
              active
                ? 'bg-orange-50 text-orange-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
