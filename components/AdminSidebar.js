'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardList, Users, BarChart3, Settings, Package, FileSpreadsheet, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ThemeToggle from '@/components/ThemeToggle'
import {
  SidebarBrand, SidebarSwitcher, SidebarGroupLabel, SidebarNavRow,
  SidebarUserFooter, SidebarMenuItem, SidebarAvatar, SidebarIconButton,
  SIDEBAR_SURFACE,
} from '@/components/SidebarParts'

/**
 * The admin area's section switcher, built from the same parts as StationSidebar so the two
 * read as one app.
 *
 * Two shapes, and they differ more than the station sidebar's two do:
 *   sm and up → the full column: brand, who you are, the menu, and the way out
 *   below sm  → the horizontal strip it has always been
 *
 * The strip stays because the admin header carries no hamburger, so there is nothing to open a
 * drawer with. Giving it one is a change to the header rather than to this file, and worth
 * doing on purpose rather than as a side effect of restyling a sidebar.
 *
 * No switcher options and no meta card: admin is not scoped to a station, so there is nowhere
 * to switch to, and there is no standing status to report. The identity block still renders,
 * without an affordance, so this column and the station one line up.
 */

const LINKS = [
  { href: '/admin', label: 'Subscriptions', icon: ClipboardList },
  { href: '/admin/services', label: 'Services', icon: Package },
  { href: '/admin/users', label: 'Staff', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/excel-templates', label: 'Excel Templates', icon: FileSpreadsheet },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const brandMark = (
    <Image src="/icon-192.png" alt="" aria-hidden width={32} height={32} className="w-8 h-8 shrink-0" />
  )

  return (
    <>
      {/* Below sm: the strip. Same destinations, same active treatment, laid along the top
          because there is no room for a column and no hamburger to hide one behind. */}
      <nav className="sm:hidden flex gap-1 overflow-x-auto border-b border-line px-2 py-2 bg-surface">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 px-3 py-2 text-[13px] whitespace-nowrap transition-colors ${
                active
                  ? 'text-primary-700 dark:text-primary-300 font-semibold border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-content-strong hover:bg-subtle'
              }`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* sm and up: the column. Sticky under the app header, which is h-14 — the layout
          already subtracts that, so this matches it rather than running past the bottom. */}
      <aside className={`hidden sm:flex flex-col sticky top-14 self-start h-[calc(100vh-3.5rem)] shrink-0 w-60 border-r border-white/15 ${SIDEBAR_SURFACE}`}>
        <SidebarBrand mark={brandMark} name="StationMGR" href="/dashboard" />
        <SidebarSwitcher
          avatar={<SidebarAvatar name="Admin" />}
          title="Platform"
          subtitle="Admin"
          options={[]}
        />
        <nav className="flex-1 overflow-y-auto sidebar-scroll pb-3">
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <ul className="space-y-0.5">
            {LINKS.map((l) => (
              <SidebarNavRow
                key={l.href}
                href={l.href}
                label={l.label}
                icon={l.icon}
                active={pathname === l.href}
              />
            ))}
          </ul>
          {/* Appearance and sign out sit IN the menu, at the end of it. No collapse here:
              this column has no collapsed state. */}
          <div className="mt-5 pt-3 border-t border-white/30 px-3 space-y-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-1 py-2 text-[13px] text-white/90 hover:text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </nav>
        <SidebarUserFooter
          avatar={<SidebarAvatar name="Admin" />}
          name="Admin"
        />
      </aside>
    </>
  )
}
