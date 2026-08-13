'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronsUpDown, MoreVertical, Check } from 'lucide-react'

/**
 * The pieces every sidebar in this app is built from.
 *
 * Six zones, in this order: brand, switcher, nav rows under group labels, a meta card, and a
 * user footer. They live here rather than inside one sidebar because BusinessSidebar and
 * AdminSidebar are the same object at two scopes, and the previous pair had drifted into two
 * different layouts that happened to sit in the same place.
 *
 * The column sits on the app's own blue, so nothing inside it can take its colour from the
 * page's semantic tokens — text-content on a blue ground is unreadable. Everything here is
 * pitched against that ground instead, through the ON_* constants below.
 *
 * Square throughout, per DESIGN_SYSTEM.md. Avatars are the documented exception and stay round.
 * The reference this is modelled on rounds its switcher and meta card; matching that would have
 * left two rounded things in an otherwise square app, so the layout is matched and the corners
 * are not.
 */

/** The ground itself. Deeper in dark mode so the column does not glow against a dark page. */
export const SIDEBAR_SURFACE = 'bg-primary-600 dark:bg-primary-950'

// Pitched against that ground rather than the page's tokens.
const ON_TEXT = 'text-white'
const ON_MUTED = 'text-white/70'
const ON_FAINT = 'text-white/60'
const ON_LINE = 'border-white/15'
const ON_HOVER = 'hover:bg-white/10'
const ON_FILL = 'bg-white/10'

/**
 * Popovers are NOT blue. A menu that adopted the column's ground would read as part of the
 * column rather than as something that opened on top of it, so these keep the page's surface
 * and its normal text tokens.
 */
const POPOVER = 'bg-surface border border-line shadow-lg'

/* ── Brand ───────────────────────────────────────────────────────────────── */

/**
 * The APP's mark and name, not the current workspace's. The workspace is named by the switcher
 * directly below, and spending the top row on it too said the same thing twice.
 *
 * h-14 matches the app header beside it, so the two bottom rules meet in one line.
 *
 * The wordmark is text-xl. It was briefly set to the mark's full height, which looked right in
 * isolation and truncated the name in the actual column — a brand that reads "StationMG…" is
 * worse than a slightly shorter one. Sized to fit the narrowest column with room to spare.
 */
export function SidebarBrand({ mark, name, href = '/', iconOnly = false }) {
  const inner = iconOnly ? (
    <div className="flex items-center justify-center h-14">{mark}</div>
  ) : (
    <div className="flex items-center gap-2.5 px-4 sm:px-5 h-14 min-w-0">
      {mark}
      <span className={`text-xl leading-none font-bold ${ON_TEXT} truncate`}>{name}</span>
    </div>
  )
  return (
    <div className={`border-b ${ON_LINE} shrink-0`}>
      {href ? <Link href={href} className={`block ${ON_HOVER} transition-colors`}>{inner}</Link> : inner}
    </div>
  )
}

/* ── Switcher ────────────────────────────────────────────────────────────── */

/**
 * Which workspace you are in, and the way to another one.
 *
 * The chevrons are a promise, so this opens a real list rather than linking away to a picker
 * screen: a control that looks like a select and navigates instead is the kind of small lie
 * that makes an interface feel untrustworthy. When there is only one place to be, it renders
 * as a plain identity block with no affordance at all.
 */
export function SidebarSwitcher({ avatar, title, subtitle, options = [], currentId, onPick, iconOnly = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (iconOnly) {
    return <div className="flex justify-center py-3" title={title}>{avatar}</div>
  }

  const switchable = options.length > 1

  const face = (
    <div className="flex items-center gap-2.5 w-full px-2.5 py-2 min-w-0">
      {avatar}
      <div className="min-w-0 flex-1 text-left">
        <p className={`text-[13px] font-bold ${ON_TEXT} truncate leading-tight`}>{title}</p>
        {subtitle && <p className={`text-[11px] ${ON_MUTED} truncate leading-tight mt-0.5`}>{subtitle}</p>}
      </div>
      {switchable && <ChevronsUpDown className={`w-4 h-4 shrink-0 ${ON_FAINT}`} aria-hidden />}
    </div>
  )

  return (
    <div className="px-3 py-3 relative" ref={ref}>
      {switchable ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={`w-full ${ON_FILL} hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
          >
            {face}
          </button>
          {open && (
            <ul role="listbox" className={`absolute left-3 right-3 top-[calc(100%-0.25rem)] z-30 max-h-72 overflow-y-auto py-1 ${POPOVER}`}>
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.id === currentId}
                    onClick={() => { setOpen(false); onPick?.(o) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-subtle transition-colors"
                  >
                    <span className="min-w-0 flex-1 text-[13px] text-content truncate">{o.label}</span>
                    {o.id === currentId && <Check className="w-4 h-4 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className={`w-full ${ON_FILL}`}>{face}</div>
      )}
    </div>
  )
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */

/** The uppercase heading over a group. `trailing` carries the accordion chevron where used. */
export function SidebarGroupLabel({ children, trailing, ...rest }) {
  const cls = `w-full flex items-center justify-between gap-2 px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${ON_FAINT}`
  if (!rest.onClick) return <p className={cls}>{children}</p>
  return (
    <button type="button" className={`${cls} hover:text-white transition-colors`} {...rest}>
      <span>{children}</span>
      {trailing}
    </button>
  )
}

/**
 * One destination.
 *
 * The active rail sits on the RIGHT edge. That is the reference's choice and it is the better
 * one here: the left edge of every row already carries the icon column, so a left rail competes
 * with it, while the right edge is empty except for the badge.
 *
 * On blue, the current row is marked by a white rail and full-strength white text against its
 * dimmer neighbours — the primary-tinted treatment this used has no contrast to work with here.
 */
export function SidebarNavRow({ href, label, icon: Icon, active, badge, iconOnly, onClick, disabled }) {
  return (
    <li>
      <Link
        // Blocked destinations are DIMMED rather than hidden, which is the station hub's rule:
        // it tells a member the feature exists and who to ask, instead of leaving a hole they
        // cannot name. The href is neutered so a middle-click cannot route around the dimming.
        href={disabled ? '#' : href}
        onClick={(e) => { if (disabled) { e.preventDefault(); return } onClick?.(e) }}
        aria-disabled={disabled || undefined}
        title={iconOnly ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`relative flex items-center transition-colors ${
          iconOnly ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 pl-4 pr-3 py-2'
        } ${
          disabled
            ? 'text-white/35 cursor-not-allowed'
            : active
              ? `${ON_TEXT} font-semibold ${ON_FILL}`
              : `${ON_MUTED} ${ON_HOVER} hover:text-white`
        }`}
      >
        <span className="relative shrink-0 flex">
          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
          {/* Collapsed there is no room for a count, so the badge degrades to a dot: it still
              says "something is new", which is the part that matters at 72px wide. */}
          {badge > 0 && iconOnly && (
            <span aria-hidden className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          )}
        </span>
        {!iconOnly && <span className="text-[13px] truncate flex-1">{label}</span>}
        {!iconOnly && badge > 0 && (
          <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 tabular-nums">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {active && !iconOnly && (
          <span aria-hidden className="absolute right-0 top-1 bottom-1 w-[3px] bg-white" />
        )}
      </Link>
    </li>
  )
}

/* ── Meta card ───────────────────────────────────────────────────────────── */

/**
 * The standing status block above the footer.
 *
 * Dark on every theme, exactly as in the reference, where it is the one inverted element in all
 * three variants — including the blue one. That inversion is doing work: it is the only thing
 * in the column that is not a destination, so it should not read as one.
 */
export function SidebarMetaCard({ title, lines = [], value, percent, action }) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0))
  return (
    <div className="mx-3 mb-3 shrink-0 bg-neutral-900 border border-black/30 px-3.5 py-3">
      <p className="text-[13px] font-bold text-white leading-tight">{title}</p>
      {lines.map((l) => (
        <p key={l} className="text-[11px] text-neutral-400 leading-snug mt-0.5">{l}</p>
      ))}
      {percent != null && (
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex-1 h-1 bg-neutral-700">
            <div className="h-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-white tabular-nums shrink-0">{value}</span>
        </div>
      )}
      {action}
    </div>
  )
}

/* ── User footer ─────────────────────────────────────────────────────────── */

/**
 * Who is signed in, and the way out.
 *
 * Appearance and collapse are VISIBLE, in their own slim row under the name. They were briefly
 * folded into the kebab alongside sign out, on the reasoning that they are occasional
 * decisions — but a control you use occasionally is not the same as one you should have to go
 * looking for, and hiding a theme toggle behind a menu means nobody finds it. The kebab keeps
 * sign out, which is the one thing that should take a deliberate extra tap.
 */
export function SidebarUserFooter({ name, subtitle, avatar, menu, controls, iconOnly = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      className={`border-t ${ON_LINE} shrink-0 relative`}
      // Bottom-most element in a full-height panel, so it owns the notch clearance.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      ref={ref}
    >
      <div className={`flex items-center gap-2.5 ${iconOnly ? 'justify-center px-2 py-3' : 'px-4 py-3'}`}>
        {/* Collapsed, the avatar IS the trigger. It has to be something: the menu is the only
            way back to Expand, so a rail without it is a one-way door — you collapse the
            column and can never widen it again except by clearing storage. */}
        {iconOnly ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Account options"
            className="flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            {avatar}
          </button>
        ) : (
          <>
            {avatar}
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold ${ON_TEXT} truncate leading-tight`}>{name}</p>
              {subtitle && <p className={`text-[11px] ${ON_MUTED} truncate leading-tight mt-0.5`}>{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label="Account options"
              className={`w-8 h-8 shrink-0 flex items-center justify-center ${ON_FAINT} hover:text-white ${ON_HOVER} transition-colors`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {/* Appearance and collapse, on their own line so they are visible without opening
          anything. Collapsed the row stacks, since 4.5rem has no width for two side by side. */}
      {controls && (
        <div className={`flex items-center gap-1 pb-2 ${iconOnly ? 'flex-col px-2' : 'px-3'}`}>
          {controls}
        </div>
      )}

      {open && (
        // Upwards: this sits at the bottom of the viewport, so a menu below it has nowhere to
        // go. On the collapsed rail it breaks out to a readable width rather than squeezing
        // into 4.5rem, which would leave every label truncated to a couple of characters.
        <div
          role="menu"
          // Picking something closes it, which is what a menu does. Scoped to menuitems on
          // purpose: the appearance control sits in here too and cycles Light → Dark → System,
          // so closing on every click inside would make its third state unreachable.
          onClick={(e) => { if (e.target.closest('[role="menuitem"]')) setOpen(false) }}
          className={`absolute bottom-[calc(100%-0.5rem)] z-30 py-1 ${POPOVER} ${iconOnly ? 'left-2 w-56' : 'left-3 right-3'}`}
        >
          {menu}
        </div>
      )}
    </div>
  )
}

/**
 * An icon control in the footer's visible row — appearance, collapse. Square, sized to the
 * same 32px as the kebab beside it so the bar reads as one strip.
 */
export function SidebarIconButton({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-8 h-8 shrink-0 flex items-center justify-center ${ON_MUTED} hover:text-white ${ON_HOVER} transition-colors ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

/** A row inside the footer menu. Kept here so the sidebars cannot style theirs differently. */
export function SidebarMenuItem({ icon: Icon, children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-50 ${
        danger ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10' : 'text-content-strong hover:bg-subtle'
      }`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  )
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */

/**
 * Round, which is the one shape DESIGN_SYSTEM.md exempts. Most businesses have never uploaded a
 * logo, so the initial chip is the common case rather than a fallback for a broken image — and
 * on blue it is a translucent white chip rather than the page's tinted one.
 */
export function SidebarAvatar({ src, name, size = 'w-8 h-8', text = 'text-xs' }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- R2 URLs, as in StorefrontClient
    return <img src={src} alt="" className={`${size} shrink-0 object-cover rounded-full`} />
  }
  return (
    <div className={`${size} ${text} shrink-0 flex items-center justify-center font-bold rounded-full bg-white/20 text-white`} aria-hidden>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}
