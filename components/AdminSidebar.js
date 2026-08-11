'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Users, BarChart3, Settings, Package, FileSpreadsheet } from 'lucide-react'

const links = [
  { href: '/admin', label: 'Subscriptions', icon: ClipboardList },
  { href: '/admin/services', label: 'Services', icon: Package },
  { href: '/admin/users', label: 'Staff', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/excel-templates', label: 'Excel Templates', icon: FileSpreadsheet },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible border-b sm:border-b-0 sm:border-r border-line sm:w-48 sm:min-h-0 px-2 py-2 sm:py-4 bg-surface">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            // Square, not round: the design system keeps rounded corners for pills and
            // avatars only, so rounded-md comes off. Padding is untouched.
            className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              active
                ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-medium'
                : 'text-content-strong hover:bg-subtle hover:text-content'
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
