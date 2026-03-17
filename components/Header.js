'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Home } from 'lucide-react'

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
  '/dashboard/entries/consumption': 'Consumption',
  '/dashboard/entries/consumption/list': 'Consumption Entries',

  // Reports
  '/dashboard/reports/summary': 'Summary',
  '/dashboard/reports/daily-sales-report': 'Daily Sales Report',
  '/dashboard/reports/audit-report': 'Audit Report',

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

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const title = getTitle(pathname)
  const isDashboardHome = pathname === '/dashboard'

  // Derive station home link
  const stationMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)/)
  const stationId = stationMatch ? stationMatch[1] : searchParams.get('org_id')
  const homeHref = stationId ? `/dashboard/stations/${stationId}` : '/dashboard'

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">

        <div className="flex items-center gap-2">
          {!isDashboardHome && (
            <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className="text-sm font-semibold text-gray-900">{title || 'Dashboard'}</span>
        </div>

        <Link
          href={homeHref}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>
    </header>
  )
}
