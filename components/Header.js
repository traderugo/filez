'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Home, Loader2, Menu, Bell } from 'lucide-react'
import useStationUnread from '@/lib/useStationUnread'
import { OUTLINE } from '@/components/ui'

// Map paths to page titles. Back always uses router.back().
const PAGE_TITLES = {
  // Dashboard
  '/dashboard': 'Dashboard',
  '/dashboard/subscribe': 'Subscribe',
  '/dashboard/feedback': 'Help & feedback',

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

  const notifMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/notifications$/)
  if (notifMatch) return 'Notifications'

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

  // Derived above the auth early-return: useStationUnread is a hook, so it cannot sit after
  // a conditional return. It no-ops on a null station.
  const stationMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)/)
  const stationId = stationMatch ? stationMatch[1] : searchParams.get('org_id')
  const { unread } = useStationUnread(stationId)

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const title = getTitle(pathname)
  const isDashboardHome = pathname === '/dashboard'

  const homeHref = stationId ? `/dashboard/stations/${stationId}` : '/dashboard'
  const isAlreadyHome = pathname === homeHref

  const handleHomeClick = (e) => {
    e.preventDefault()
    if (isAlreadyHome || navigating) return
    setNavigating(true)
    router.push(homeHref)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-primary-500/40 dark:border-primary-400/40 bg-surface">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">

        <div className="flex items-center gap-2">
          {!isDashboardHome && (
            <button onClick={() => router.back()} className="flex items-center gap-1 text-content-strong hover:text-content">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className="text-sm font-bold text-content">{title || 'Dashboard'}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Shown at every width. It used to be lg:hidden, on the grounds that the sidebar's
              Notifications row already carries the badge above lg, which left the bell simply
              absent on desktop. The duplication is fine: both read the same useStationUnread
              hook, so the two counts cannot drift, and the sidebar's copy is a row in a list
              while this is the persistent alert. */}
          {stationId && (
            <Link
              href={`/dashboard/stations/${stationId}/notifications`}
              aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
              title="Notifications"
              className={`relative flex items-center justify-center w-9 h-9 ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center text-[10px] font-semibold bg-accent-600 text-white rounded-full">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          )}

          {/* Icon-only, matching store-portal: the label was buying width from the page title
              for a destination the house icon already names, and the hamburger shares this end
              of the bar. w-9 h-9 so the two read as a matched pair. The name moves to
              aria-label and title, so it is still announced and still hoverable. */}
          <Link
            href={homeHref}
            onClick={handleHomeClick}
            aria-label="Home"
            title="Home"
            className={`flex items-center justify-center w-9 h-9 ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
          >
            {navigating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
          </Link>

          {/* Below lg only: at lg and up the sidebar is a permanent column. It sits at this
              end of the bar, matching store-portal, because the drawer opens from the right
              and the left is the back button's. Two navigation controls should not be
              adjacent. */}
          {onMenu && (
            <button
              onClick={onMenu}
              aria-label="Open menu"
              title="Menu"
              className={`lg:hidden flex items-center justify-center w-9 h-9 ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
