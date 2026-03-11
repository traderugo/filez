'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LayoutDashboard, CreditCard,
  MessageSquare, Shield, LogOut, X, ChevronLeft, ChevronRight, ChevronDown,
  FileSpreadsheet, ClipboardList, Droplets, Users, Flame, BarChart3,
  SquarePen, ChartNoAxesCombined, Cloud, RefreshCw, Loader2, Building2,
  ArrowUpFromLine, ArrowDownToLine
} from 'lucide-react'
import { db } from '@/lib/db'
import { processQueue } from '@/lib/sync'
import { initialSync } from '@/lib/initialSync'
import { useRemoteChanges } from '@/lib/hooks/useRemoteChanges'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/subscribe', label: 'Subscribe', icon: CreditCard },
  { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquare },
]

const entryItems = [
  { key: 'daily-sales', label: 'Daily Sales', icon: FileSpreadsheet },
  { key: 'product-receipt', label: 'Product Receipt', icon: ClipboardList },
  { key: 'lodgements', label: 'Lodgements', icon: CreditCard },
  { key: 'lube', label: 'Lube', icon: Droplets },
  { key: 'customer-payments', label: 'Accounts', icon: Users },
  { key: 'consumption', label: 'Consumption', icon: Flame },
]

const reportItems = [
  { key: 'daily-sales-report', label: 'Daily Sales Report', icon: BarChart3 },
  { key: 'audit-report', label: 'Audit Report', icon: ClipboardList },
]

export default function Sidebar({ user, open, collapsed, onClose, onToggleCollapse, onSignOut }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Detect station context from URL
  const stationMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)/)
  const stationId = stationMatch ? stationMatch[1] : searchParams.get('org_id')

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pendingCount = useLiveQuery(
    () => stationId ? db.syncQueue.where('orgId').equals(stationId).count() : 0,
    [stationId],
    0
  )
  const { pendingPullCount, resetPullCount } = useRemoteChanges(stationId)

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    try { await processQueue() } catch (e) { /* offline */ }
    setSyncing(false)
  }

  const handleRefresh = async () => {
    if (refreshing || !stationId) return
    setRefreshing(true)
    try {
      await initialSync(stationId, { force: true })
      resetPullCount()
    } catch (e) { /* offline */ }
    setRefreshing(false)
  }

  const isActive = (href, exact) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isEntryActive = (key) => pathname.startsWith(`/dashboard/entries/${key}`)
  const isReportActive = (key) => pathname.startsWith(`/dashboard/reports/${key}`)

  const anyEntryActive = entryItems.some(({ key }) => isEntryActive(key))
  const anyReportActive = reportItems.some(({ key }) => isReportActive(key))

  const [entriesOpen, setEntriesOpen] = useState(anyEntryActive)
  const [reportsOpen, setReportsOpen] = useState(anyReportActive)

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
            <Image src="/icon-192.png" alt="StationMGR" width={28} height={28} className="rounded flex-shrink-0" />
            <span className={collapsed ? 'sm:hidden' : ''}>{collapsed ? '' : 'StationMGR'}</span>
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

          {/* Station-contextual links */}
          {stationId && (
            <>
              {/* Push (sync to server) */}
              <button
                onClick={handleSync}
                disabled={syncing || pendingCount === 0}
                title={collapsed ? (pendingCount > 0 ? `Push ${pendingCount} pending` : 'All pushed') : undefined}
                className={`relative flex items-center rounded-md text-sm ${
                  collapsed
                    ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                    : 'gap-3 px-3 py-2'
                } ${
                  pendingCount > 0
                    ? 'text-yellow-700 hover:bg-yellow-50'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } disabled:opacity-40`}
              >
                {syncing ? <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" /> : <ArrowUpFromLine className="w-5 h-5 flex-shrink-0" />}
                <span className={collapsed ? 'sm:hidden' : ''}>Push</span>
                {pendingCount > 0 && (
                  <span className="ml-auto bg-yellow-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>

              {/* Pull (refresh from server) */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title={collapsed ? 'Pull data from server' : undefined}
                className={`relative flex items-center rounded-md text-sm ${
                  collapsed
                    ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                    : 'gap-3 px-3 py-2'
                } ${
                  pendingPullCount > 0
                    ? 'text-blue-700 hover:bg-blue-50'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } disabled:opacity-40`}
              >
                {refreshing ? <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" /> : <ArrowDownToLine className="w-5 h-5 flex-shrink-0" />}
                <span className={collapsed ? 'sm:hidden' : ''}>Pull</span>
                {pendingPullCount > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingPullCount > 9 ? '9+' : pendingPullCount}
                  </span>
                )}
              </button>

              {/* Divider */}
              <hr className={`my-2 border-gray-200 ${collapsed ? 'sm:mx-1' : ''}`} />

              {/* Station Overview */}
              <Link
                href={`/dashboard/stations/${stationId}`}
                onClick={onClose}
                title={collapsed ? 'Station Overview' : undefined}
                className={`flex items-center rounded-md text-sm ${
                  collapsed
                    ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                    : 'gap-3 px-3 py-2'
                } ${
                  pathname === `/dashboard/stations/${stationId}`
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Building2 className="w-5 h-5 flex-shrink-0" />
                <span className={collapsed ? 'sm:hidden' : ''}>Station Overview</span>
              </Link>

              {/* Entries */}
              <div className={`pt-3 ${collapsed ? 'sm:pt-2' : ''}`}>
                <button
                  onClick={() => setEntriesOpen((o) => !o)}
                  title={collapsed ? 'Entries' : undefined}
                  className={`flex items-center w-full rounded-md text-sm ${
                    collapsed
                      ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                      : 'gap-3 px-3 py-2'
                  } ${
                    anyEntryActive
                      ? 'text-blue-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <SquarePen className="w-4 h-4 flex-shrink-0" />
                  <span className={`flex-1 text-left text-xs font-semibold uppercase tracking-wide ${collapsed ? 'sm:hidden' : ''}`}>Entries</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${entriesOpen ? 'rotate-180' : ''} ${collapsed ? 'sm:hidden' : ''}`} />
                </button>
                {entriesOpen && entryItems.map(({ key, label, icon: Icon }) => {
                  const href = `/dashboard/entries/${key}?org_id=${stationId}`
                  return (
                    <Link
                      key={key}
                      href={href}
                      onClick={onClose}
                      title={collapsed ? label : undefined}
                      className={`flex items-center rounded-md text-sm ${
                        collapsed
                          ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                          : 'gap-3 px-3 py-2 pl-6'
                      } ${
                        isEntryActive(key)
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className={collapsed ? 'sm:hidden' : ''}>{label}</span>
                    </Link>
                  )
                })}
              </div>

              {/* Reports */}
              <div className={`pt-3 ${collapsed ? 'sm:pt-2' : ''}`}>
                <button
                  onClick={() => setReportsOpen((o) => !o)}
                  title={collapsed ? 'Reports' : undefined}
                  className={`flex items-center w-full rounded-md text-sm ${
                    collapsed
                      ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                      : 'gap-3 px-3 py-2'
                  } ${
                    anyReportActive
                      ? 'text-blue-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <ChartNoAxesCombined className="w-4 h-4 flex-shrink-0" />
                  <span className={`flex-1 text-left text-xs font-semibold uppercase tracking-wide ${collapsed ? 'sm:hidden' : ''}`}>Reports</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${reportsOpen ? 'rotate-180' : ''} ${collapsed ? 'sm:hidden' : ''}`} />
                </button>
                {reportsOpen && reportItems.map(({ key, label, icon: Icon }) => {
                  const href = `/dashboard/reports/${key}?org_id=${stationId}`
                  return (
                    <Link
                      key={key}
                      href={href}
                      onClick={onClose}
                      title={collapsed ? label : undefined}
                      className={`flex items-center rounded-md text-sm ${
                        collapsed
                          ? 'sm:justify-center sm:px-0 sm:py-2.5 gap-3 px-3 py-2'
                          : 'gap-3 px-3 py-2 pl-6'
                      } ${
                        isReportActive(key)
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className={collapsed ? 'sm:hidden' : ''}>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </>
          )}

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
