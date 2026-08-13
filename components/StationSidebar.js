'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePathname, useSearchParams, useParams, useRouter } from 'next/navigation'
import { Home, LogOut, PanelLeftClose, PanelLeft, X, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { buildStationNav } from '@/lib/stationNav'
import ThemeToggle from '@/components/ThemeToggle'
import {
  SidebarBrand, SidebarSwitcher, SidebarGroupLabel, SidebarNavRow,
  SidebarUserFooter, SidebarMenuItem, SidebarAvatar, SidebarIconButton,
  SIDEBAR_SURFACE,
} from '@/components/SidebarParts'

/**
 * Section switcher for the pages inside a station, so moving from Daily Sales to Lodgements
 * is one tap instead of Home-then-tile.
 *
 * Two presentations of one list:
 *   lg and up → a persistent column, collapsible to icons, running the full height
 *   below lg  → an overlay drawer, opened by the parent (this one is controlled)
 *
 * It renders buildStationNav(), the same source the station hub reads, so the two cannot
 * offer different destinations.
 *
 * Built from the same parts as store-portal's sidebars, in the same six zones: brand, the
 * station you are in (and the way to another), the menu, and who is signed in.
 *
 * Blocked destinations are shown dimmed rather than hidden, matching the hub: that tells a
 * member the feature exists and who to ask, instead of leaving a hole they cannot name.
 *
 * NO meta card, unlike store-portal's business sidebar. That slot reports where a
 * subscription stands, and station-portal has no endpoint that answers it — there is a
 * subscription-check for one service at a time, but nothing that reports days remaining.
 * An empty card would be worse than none.
 */
export default function StationSidebar({ open, onClose }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const router = useRouter()

  // The station is in the path on the hub, and in ?org_id= on every entry and report screen.
  const stationId = params?.stationId || searchParams.get('org_id') || ''

  const [collapsed, setCollapsed] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [visiblePages, setVisiblePages] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [user, setUser] = useState(null)
  const [stations, setStations] = useState([])

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
        // The unscoped list, not ?org_id=: the switcher needs every station this person can
        // reach, and the ownership check below only needs to find the current one inside it.
        const [orgRes, me] = await Promise.all([
          fetch('/api/organizations'),
          fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])
        if (!alive) return

        const body = orgRes.ok ? await orgRes.json() : {}
        const reachable = [...(body.stations || []), ...(body.memberStations || [])]
        const deduped = [...new Map(reachable.map((s) => [s.id, s])).values()]
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setStations(deduped)
        setUser(me?.user || null)

        const found = deduped.find((s) => String(s.id) === String(stationId)) || null
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
  const current = stations.find((s) => String(s.id) === String(stationId))

  const isCurrent = (href) => pathname === href.split('?')[0]

  const row = (link, iconOnly) => (
    <SidebarNavRow
      key={link.href}
      href={link.href}
      label={link.label}
      icon={link.icon}
      active={isCurrent(link.href)}
      badge={link.badge}
      disabled={!link.allowed}
      iconOnly={iconOnly}
      onClick={() => onClose?.()}
    />
  )

  const nav = (iconOnly) => (
    <nav className="flex-1 overflow-y-auto sidebar-scroll pb-3">
      {/* Station home leads, ungrouped and above the first heading — the reference's own first
          row. It was a centred outline button, which made the hub look like an action rather
          than a place; as a row it is marked by the same rail as everything else. */}
      <ul className="mb-4">
        <SidebarNavRow
          href={home}
          label="Station home"
          icon={Home}
          active={pathname === home}
          iconOnly={iconOnly}
          onClick={() => onClose?.()}
        />
      </ul>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.heading}>
            {iconOnly ? (
              <p className="text-[10px] font-semibold text-content-faint uppercase tracking-[0.12em] mb-1.5 text-center">
                {section.heading.slice(0, 3)}
              </p>
            ) : (
              <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>
            )}
            <ul className="space-y-0.5">{section.links.map((l) => row(l, iconOnly))}</ul>
          </div>
        ))}

        <div>
          {iconOnly ? (
            <p className="text-[10px] font-semibold text-content-faint uppercase tracking-[0.12em] mb-1.5 text-center">Sta</p>
          ) : (
            <SidebarGroupLabel>Station</SidebarGroupLabel>
          )}
          {/* No Notifications row: the header's bell shows at every width and carries the
              unread badge, so a second entry point said what the bell already says. */}
          <ul className="space-y-0.5">
            {row({ href: `${home}/settings`, icon: Settings, label: 'Settings', allowed: true }, iconOnly)}
          </ul>
        </div>
      </div>

      {/* Appearance and sign out sit IN the menu, at the end of it. They were behind
          a kebab in the footer, which is where controls go to not be found. */}
      <div className={`mt-5 pt-3 border-t border-white/30 ${iconOnly ? 'flex flex-col items-center gap-1' : 'px-3 space-y-1'}`}>
        <ThemeToggle />
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          title={iconOnly ? 'Sign out' : undefined}
          aria-label={iconOnly ? 'Sign out' : undefined}
          className={`flex items-center text-white/90 hover:text-white hover:bg-white/20 transition-colors disabled:opacity-50 ${
            iconOnly ? 'justify-center w-10 h-10' : 'w-full gap-3 px-1 py-2 text-[13px]'
          }`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!iconOnly && <span>Sign out</span>}
        </button>
      </div>
    </nav>
  )

  const switcher = (iconOnly) => (
    <SidebarSwitcher
      iconOnly={iconOnly}
      avatar={<SidebarAvatar name={current?.name || 'Station'} />}
      title={current?.name || 'Station'}
      subtitle={isOwner ? 'Owner' : 'Staff member'}
      currentId={stationId}
      options={stations.map((s) => ({ id: String(s.id), label: s.name }))}
      onPick={(o) => { if (String(o.id) !== String(stationId)) router.push(`/dashboard/stations/${o.id}`) }}
    />
  )

  const userFooter = (iconOnly, withCollapse) => (
    <SidebarUserFooter
      iconOnly={iconOnly}
      avatar={<SidebarAvatar name={user?.name || user?.email} />}
      name={user?.name || user?.email || 'Account'}
      subtitle={user?.email && user?.name ? user.email : null}
      onToggleCollapse={withCollapse ? toggleCollapsed : undefined}
      collapsed={collapsed}
      collapseIcons={[PanelLeftClose, PanelLeft]}
    />
  )

  const brandMark = (
    <Image src="/icon-192.png" alt="" aria-hidden width={32} height={32} className="w-8 h-8 shrink-0" />
  )

  return (
    <>
      {/* Desktop: a real column in normal flow, so collapsing it reflows the content beside
          it without any width being synced between the two. */}
      <aside
        className={`hidden lg:flex flex-col sticky top-0 self-start h-screen shrink-0 border-r border-white/15 ${SIDEBAR_SURFACE} transition-[width] duration-150 ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <SidebarBrand mark={brandMark} name="StationMGR" href="/dashboard" iconOnly={collapsed} />
        {switcher(collapsed)}
        {nav(collapsed)}
        {userFooter(collapsed, true)}
      </aside>

      {/* Below lg: overlay drawer, matching store-portal's. Kept mounted so it slides rather
          than appears, and it opens from the RIGHT, meeting the hamburger, which sits on the
          right of the header because the left is the back button's and two navigation
          controls should not sit adjacent. The desktop column stays on the left; the two
          never co-exist (lg:hidden vs hidden lg:flex), so no one sees the nav on both edges. */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      )}
      <aside
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] flex flex-col ${SIDEBAR_SURFACE} border-l border-white/15 transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
        {...(!open && { inert: '' })}
      >
        {/* Close rides over the brand row, flush to the same edge as the header, so the X
            lands where the hamburger was. Same href as the column's: the two panels must
            render the same links. */}
        <div className="relative shrink-0">
          <SidebarBrand mark={brandMark} name="StationMGR" href="/dashboard" />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 text-content-faint hover:text-content hover:bg-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {switcher(false)}
        {nav(false)}
        {userFooter(false, false)}
      </aside>
    </>
  )
}
