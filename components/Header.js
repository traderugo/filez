'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Home } from 'lucide-react'

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
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]

  const settingsMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/settings$/)
  if (settingsMatch) return { back: `/dashboard/stations/${settingsMatch[1]}`, title: 'Settings' }

  const chatMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/chat$/)
  if (chatMatch) return { back: `/dashboard/stations/${chatMatch[1]}`, title: 'Chat' }

  const stationMatch = pathname.match(/^\/dashboard\/stations\/[^/]+$/)
  if (stationMatch) return { back: '/dashboard', title: 'Station' }

  const setupMatch = pathname.match(/^\/dashboard\/setup\/[^/]+$/)
  if (setupMatch) return { back: '/dashboard', title: 'Setup' }

  return null
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const pageInfo = getPageInfo(pathname)

  // Derive station home link: /dashboard/stations/[stationId]
  // From URL path (station sub-pages) or org_id search param (reports, entries)
  const stationMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)/)
  const stationId = stationMatch ? stationMatch[1] : searchParams.get('org_id')
  const homeHref = stationId ? `/dashboard/stations/${stationId}` : '/dashboard'

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">

        <div className="flex items-center gap-2">
          {/* Back button + title or page name */}
          {pageInfo ? (
            <button onClick={() => router.push(pageInfo.back)} className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-semibold">{pageInfo.title}</span>
            </button>
          ) : (
            <h1 className="text-sm font-semibold text-gray-900">Dashboard</h1>
          )}
        </div>

        {/* Home button — goes to station overview if station context exists */}
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
