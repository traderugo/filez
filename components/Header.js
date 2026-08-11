'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Home, Loader2, Menu } from 'lucide-react'
import { OUTLINE } from '@/components/ui'

// Map paths to page titles. Back always uses router.back().
const PAGE_TITLES = {
  // Dashboard
  '/dashboard': 'Dashboard',
  '/dashboard/subscribe': 'Subscribe',
  '/dashboard/feedback': 'Feedback',

  // Entries
  '/dashboard/entries': 'Entries',
  '/dashboard/entries/daily-sales': 'Daily Sales',
  '/dashboard/entries/daily-sales/list': 'Daily Sales Entries',
  '/dashboard/entries/product-receipt': 'Product Receipt',
  '/dashboard/entries/product-receipt/list': 'Receipt Entries',
  '/dashboard/entries/lodgements': 'Lodgements',
  '/dashboard/entries/lodgements/list': 'Lodgement Entries',
  '/dashboard/entries/lube': 'Lube',
  '/dashboard/entries/lube/list': 'Lube Entries',
  '/dashboard/entries/customer-payments': 'Account Payment',
  '/dashboard/entries/customer-payments/list': 'Account Entries',

  // Reports
  '/dashboard/reports/summary': 'Summary',
  '/dashboard/reports/daily-sales-report': 'Daily Sales Report',
  '/dashboard/reports/sales-overview': 'Sales Overview',
  '/dashboard/reports/inventory-log': 'Inventory Log',
  '/dashboard/reports/analytics': 'Analytics',
  '/dashboard/reports/audit-report': 'Audit Report',
  '/dashboard/reports/account-ledger': 'Account Ledger',
  '/dashboard/reports/product-received': 'Product Received',
  '/dashboard/reports/dip-calculator': 'Dip Calculator',

  // Admin
  '/admin': 'Subscriptions',
  '/admin/services': 'Services',
  '/admin/users': 'Staff',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Stations',
  '/admin/excel-templates': 'Excel Templates',
}

function getTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]

  const settingsMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/settings$/)
  if (settingsMatch) return 'Settings'

  const chatMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/chat$/)
  if (chatMatch) return 'Chat'

  const stationMatch = pathname.match(/^\/dashboard\/stations\/[^/]+$/)
  if (stationMatch) return 'Station'

  const setupMatch = pathname.match(/^\/dashboard\/setup\/[^/]+$/)
  if (setupMatch) return 'Setup'

  const payMatch = pathname.match(/^\/dashboard\/subscribe\/pay\//)
  if (payMatch) return 'Payment'

  return null
}

export default function Header({ onMenu }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)

  // Reset spinner when route changes
  useEffect(() => { setNavigating(false) }, [pathname])

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const title = getTitle(pathname)
  const isDashboardHome = pathname === '/dashboard'

  // Derive station home link
  const stationMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)/)
  const stationId = stationMatch ? stationMatch[1] : searchParams.get('org_id')
  const homeHref = stationId ? `/dashboard/stations/${stationId}` : '/dashboard'
  const isAlreadyHome = pathname === homeHref

  const handleHomeClick = (e) => {
    e.preventDefault()
    if (isAlreadyHome || navigating) return
    setNavigating(true)
    router.push(homeHref)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">

        <div className="flex items-center gap-2">
          {/* Below lg only: at lg and up the sidebar is a permanent column. */}
          {onMenu && (
            <button onClick={onMenu} aria-label="Open menu" className="lg:hidden p-1 -ml-1 text-content-strong hover:text-content">
              <Menu className="w-5 h-5" />
            </button>
          )}
          {!isDashboardHome && (
            <button onClick={() => router.back()} className="flex items-center gap-1 text-content-strong hover:text-content">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className="text-sm font-semibold text-content">{title || 'Dashboard'}</span>
        </div>

        {/* OUTLINE is the design system's control look. Padding and text size are left
            exactly as they were so the header's 14-unit row does not shift. */}
        <Link
          href={homeHref}
          onClick={handleHomeClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
        >
          {navigating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
          <span>Home</span>
        </Link>
      </div>
    </header>
  )
}
