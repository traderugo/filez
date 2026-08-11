'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useParams, useRouter } from 'next/navigation'
import { Fuel, Home, LogOut, PanelLeftClose, PanelLeft, X, Bell, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { buildStationNav } from '@/lib/stationNav'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * Section switcher for the pages inside a station, so moving from Daily Sales to Lodgements
 * is one tap instead of Home-then-tile.
 *
 * Two presentations of one list:
 *   lg and up → a persistent column, collapsible to icons, running the full height
 *   below lg  → an overlay drawer opened by the header's hamburger
 *
 * It renders buildStationNav(), the same source the station hub reads, so the two cannot
 * offer different destinations.
 *
 * Blocked destinations are shown dimmed rather than hidden, matching the hub: that tells a
 * member the feature exists and who to ask, instead of leaving a hole they cannot name.
 *
 * Sign out lives here because the alternative is three taps into the station hub, and a way
 * out should not be something you navigate to find. The theme toggle sits in the scrolling
 * part rather than the footer so the footer stays a fixed two-button bar.
 */
export default function StationSidebar({ open, onClose }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const router = useRouter()

  // The station is in the path on the hub, and in ?org_id= on every entry and report screen.
  const stationId = params?.stationId || searchParams.get('org_id') || ''

  const [collapsed, setCollapsed] = useState(false)
  const [station, setStation] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [visiblePages, setVisiblePages] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  // Read AFTER mount, not in the useState initializer: this renders on the server too, and
  // localStorage does not exist there.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('stationSidebarCollapsed') === '1') } catch {}
  }, [])
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem('stationSidebarCollapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  useEffect(() => {
    if (!stationId) return
    let alive = true
    ;(async () => {
      try {
        const [orgRes, me] = await Promise.all([
          fetch(`/api/organizations?org_id=${encodeURIComponent(stationId)}`),
          fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])
        if (!alive) return

        const found = orgRes.ok ? ((await orgRes.json()).stations || [])[0] || null : null
        setStation(found)
        // Compared here rather than in a later setState: `station` would be the previous
        // render's value inside this closure, so ownership would lag one load behind.
        setIsOwner(!!found && !!me?.user?.id && found.owner_id === me.user.id)

        // Same endpoint the hub uses. Staff get visible_pages; an owner gets none, which
        // is why isOwner carries the decision instead.
        const perm = await fetch(`/api/invites?org_id=${stationId}`)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (alive) setVisiblePages(perm?.visiblePages || null) // null = unrestricted
      } catch { /* offline: the nav still renders, just without permission dimming */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (!stationId) return null

  // visiblePages null means "not restricted", which buildStationNav reads as owner-like.
  const sections = buildStationNav(stationId, { isOwner: isOwner || visiblePages == null, visiblePages })
  const home = `/dashboard/stations/${stationId}`
  const iconOnly = collapsed

  const isCurrent = (href) => {
    const path = href.split('?')[0]
    return pathname === path
  }

  const item = (link) => {
    const Icon = link.icon
    const current = isCurrent(link.href)
    return (
      <li key={link.href}>
        <Link
          href={link.allowed ? link.href : '#'}
          onClick={(e) => { if (!link.allowed) e.preventDefault(); else onClose?.() }}
          aria-current={current ? 'page' : undefined}
          title={iconOnly ? link.label : undefined}
          className={`relative flex items-center gap-2.5 py-2 text-sm transition-colors ${
            iconOnly ? 'justify-center px-0' : 'px-3'
          } ${
            !link.allowed
              ? 'text-content-faint opacity-50 cursor-not-allowed'
              : current
                ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-semibold'
                : 'text-content-strong hover:bg-subtle hover:text-content'
          }`}
        >
          {current && !iconOnly && (
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600 dark:bg-primary-400" />
          )}
          <Icon className="w-4 h-4 shrink-0" fill="currentColor" />
          {!iconOnly && <span className="truncate">{link.label}</span>}
        </Link>
      </li>
    )
  }

  const identity = iconOnly ? (
    <div className="flex items-center justify-center h-14 shrink-0">
      <Fuel className="w-5 h-5 text-primary-600 dark:text-primary-300" />
    </div>
  ) : (
    // h-14 matches the header row exactly, so the two line up across the seam.
    <div className="flex items-center gap-2.5 px-4 h-14 shrink-0 min-w-0">
      <Fuel className="w-5 h-5 text-primary-600 dark:text-primary-300 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-content truncate">{station?.name || 'Station'}</p>
        {station?.location && <p className="text-[11px] text-content-muted truncate">{station.location}</p>}
      </div>
    </div>
  )

  const nav = (
    <nav className="flex-1 overflow-y-auto py-2">
      {/* Home leads, as the one emphasised destination. */}
      <div className={`mb-4 ${iconOnly ? 'flex justify-center' : 'px-1'}`}>
        <Link
          href={home}
          onClick={() => onClose?.()}
          title={iconOnly ? 'Station home' : undefined}
          className={`flex items-center gap-2 py-2 text-sm font-semibold border-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/20 transition-all ${
            iconOnly ? 'justify-center w-10' : 'px-3 w-full'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" fill="currentColor" />
          {!iconOnly && <span>Station home</span>}
        </Link>
      </div>

      {sections.map((section) => (
        <div key={section.heading} className="mb-5">
          {!iconOnly && (
            <h2 className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-faint">
              {section.heading}
            </h2>
          )}
          <ul>{section.links.map(item)}</ul>
        </div>
      ))}

      <div className="mb-5">
        {!iconOnly && (
          <h2 className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-faint">Station</h2>
        )}
        <ul>
          {item({ href: `${home}/notifications`, icon: Bell, label: 'Notifications', allowed: true, pageKey: 'notifications' })}
          {item({ href: `${home}/settings`, icon: Settings, label: 'Settings', allowed: true, pageKey: 'settings' })}
        </ul>
      </div>

      {/* In the scrolling part, not the footer: the footer is a fixed two-button bar. */}
      <div className={`mt-5 ${iconOnly ? 'flex justify-center' : 'px-1'}`}>
        <ThemeToggle />
      </div>
    </nav>
  )

  const footer = (
    <div className="border-t border-line p-2 flex items-center gap-2 shrink-0">
      <button
        onClick={signOut}
        disabled={signingOut}
        title="Sign out"
        className={`flex items-center justify-center gap-2 py-2 text-sm font-medium text-content-muted hover:text-content hover:bg-subtle transition-colors disabled:opacity-50 ${
          iconOnly ? 'w-10 h-10' : 'flex-1'
        }`}
      >
        <LogOut className="w-4 h-4 shrink-0" />
        {!iconOnly && <span>Sign out</span>}
      </button>
      {/* Icon only, deliberately: a labelled Collapse costs a row of width to say what the
          icon already says. */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand' : 'Collapse'}
        className="hidden lg:flex w-10 h-10 items-center justify-center shrink-0 text-content-muted hover:text-content hover:bg-subtle transition-colors"
      >
        {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>
    </div>
  )

  return (
    <>
      {/* Desktop: a real column in normal flow, so collapsing it reflows the content beside
          it without any width being synced between the two. */}
      <aside
        className={`hidden lg:flex flex-col sticky top-0 self-start h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-150 ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        {identity}
        {nav}
        {footer}
      </aside>

      {/* Below lg: overlay drawer. */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-surface border-r border-line">
            <div className="flex items-center justify-between shrink-0">
              {identity}
              <button onClick={onClose} aria-label="Close menu" className="p-3 text-content-faint hover:text-content">
                <X className="w-5 h-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  )
}
