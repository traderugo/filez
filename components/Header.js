'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, ChevronLeft } from 'lucide-react'

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

  const stationMatch = pathname.match(/^\/dashboard\/stations\/[^/]+$/)
  if (stationMatch) return { back: '/dashboard', title: 'Station' }

  const setupMatch = pathname.match(/^\/dashboard\/setup\/[^/]+$/)
  if (setupMatch) return { back: '/dashboard', title: 'Setup' }

  return null
}

export default function Header({ onToggleSidebar }) {
  const pathname = usePathname()
  const router = useRouter()

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const pageInfo = getPageInfo(pathname)

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

        {/* Hamburger (mobile only) */}
        <button className="sm:hidden p-1 text-gray-500 hover:text-gray-700" onClick={onToggleSidebar}>
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
