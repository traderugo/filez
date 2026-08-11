'use client'

/**
 * Shared UI primitives — the enforced-in-code layer of the Premeval design system, ported
 * from store-portal so the two apps look and behave the same.
 *
 * Flat cards, 2px card border (border-card), square corners, one blue accent, semantic
 * tokens for light/dark. Screens compose these instead of re-deriving classes.
 *
 * Two deliberate differences from store-portal's copy:
 *   - Links are next/link, not RippleLink. station-portal has no Ripple primitive, and
 *     adding tap-ripple to every row is a behaviour change, not a styling one.
 *   - Tile / HeroTile / FilterRail are not ported. They form page layout rather than style
 *     it, and this pass is colour and styling only. Add them if a screen needs one.
 */

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

// Shared class fragments.
export const CARD = 'bg-surface border-card border-primary-500/40 dark:border-primary-400/40'
export const CARD_HOVER = 'hover:border-primary-500 dark:hover:border-primary-400 transition-colors'
export const CHIP_MONO = 'bg-primary-100 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300'
// App-wide control look: translucent blue fill + 2px blue border, darker border when
// highlighted (focus/hover), blue text + icons. Shared by every Button variant and input.
export const OUTLINE = 'border-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 text-primary-700 dark:text-primary-300 transition-all'

/** Square mono icon chip. `variant="onColor"` for use on a filled brand surface. */
export function IconChip({ icon: Icon, className = 'w-8 h-8', iconClass = 'w-4 h-4', variant = 'mono' }) {
  const styles = variant === 'onColor' ? 'bg-white/20 text-white' : CHIP_MONO
  return (
    <div className={`flex items-center justify-center shrink-0 ${styles} ${className}`}>
      <Icon className={iconClass} />
    </div>
  )
}

/** Uppercase section label. */
export function SectionHeader({ children, className = '' }) {
  return (
    <h2 className={`text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3 ${className}`}>
      {children}
    </h2>
  )
}

/** Generic flat card container. */
export function Card({ as: As = 'div', className = '', children, ...rest }) {
  return <As className={`${CARD} ${className}`} {...rest}>{children}</As>
}

/** Small circular count badge. Renders nothing at 0. */
export function Badge({ count, className = '' }) {
  if (!count || count <= 0) return null
  return (
    <span className={`min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center text-xs font-bold bg-accent-600 text-white rounded-full ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Pulsing loading placeholder. Pass `tint` (e.g. bg-white) for colored surfaces. */
export function Skeleton({ className = '', tint = 'bg-content/10' }) {
  return <span className={`inline-block animate-pulse ${tint} ${className}`} />
}

/** Bordered container that groups Rows with dividers. */
export function RowGroup({ className = '', children }) {
  return <div className={`${CARD} divide-y divide-gray-300 dark:divide-white/15 ${className}`}>{children}</div>
}

/** One-line list row (inside a RowGroup). Optional count badge before the chevron. */
export function Row({ href, label, desc, icon, badge }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-3 hover:bg-subtle hover:ring-2 hover:ring-inset hover:ring-primary-500 transition-colors">
      <IconChip icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-content truncate">{label}</p>
        <p className="text-[11px] text-content-muted truncate">{desc}</p>
      </div>
      <Badge count={badge} />
      <ChevronRight className="w-4 h-4 shrink-0 text-content-faint" />
    </Link>
  )
}

/**
 * Action button/link. Internal href → Link; external href (target set) → plain anchor;
 * otherwise a <button>.
 *
 * Everything-outline design: no variant is ever a solid fill. What separates them is how
 * hard the outline is drawn. `framed` is the resting state, a 40% border over a 10% wash.
 * `primary` is the same box at full strength, so a form's Save does not look identical to
 * its Cancel. `danger` keeps the shape in semantic red. `quiet` has no box at all — the way
 * out of a form, with the same padding so a row still lines up.
 */
export function Button({ href, onClick, icon: Icon, children, target, rel, type = 'button', variant = 'framed', size = 'md', iconClass = 'w-4 h-4', className = '', disabled }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-3 py-2 text-sm' }
  const outlineHover = 'hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400'
  const variants = {
    framed: `${OUTLINE} ${outlineHover}`,
    // Sits where framed's hover lands, so its own hover has to go a step further again.
    primary: 'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30 dark:hover:border-primary-300',
    danger: 'border-2 border-red-500/40 dark:border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:border-red-600 dark:hover:border-red-500 transition-all',
    quiet: 'text-content-muted hover:text-content hover:bg-subtle transition-all',
  }
  const cls = `inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`
  const inner = <>{Icon && <Icon className={iconClass} />}{children}</>
  // onClick is forwarded on the anchor branch too: an external link can still have something
  // to do on the way out (closing the sheet it was opened from).
  if (href && target) return <a href={href} target={target} rel={rel} onClick={onClick} className={cls}>{inner}</a>
  if (href) return <Link href={href} className={cls}>{inner}</Link>
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>
}

/**
 * Centered empty state: icon, title, optional supporting line, optional action.
 *
 * For a WHOLE view that has nothing to show. An empty table INSIDE a populated view should
 * keep its quiet one-line form, so a page of sections does not turn into a page of
 * twelve-rem placeholders.
 */
export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && <Icon className="w-10 h-10 text-content-faint mx-auto mb-3" />}
      {title && <p className="text-sm font-semibold text-content">{title}</p>}
      {children && <p className="text-sm text-content-muted mt-0.5">{children}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  )
}

// ---- Form controls ----
// Material-style field: just a bottom border (no box, no fill), underline darkening on focus.
// Buttons keep the full OUTLINE box — this style is text/number inputs and selects only.
/**
 * The underline without a width, for the few fields that are not full-bleed: a quantity box
 * in a table row, a meter reading beside a pump name. Composing `${INPUT} w-20` instead would
 * leave `w-full` and `w-20` both in the class list, and which one wins is decided by their
 * order in the generated stylesheet rather than in the string.
 */
export const INPUT_BASE = `border-b-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 focus:bg-primary-500/15 px-2 py-2 text-sm text-content transition-colors focus:border-primary-600 dark:focus:border-primary-400 focus:outline-none disabled:opacity-50 placeholder:text-content-faint`
export const INPUT = `w-full ${INPUT_BASE}`
export const LABEL = 'block text-sm font-semibold text-content mb-1.5'

/**
 * The same underline for a control you cannot put INPUT on directly: a SearchableSelect
 * (whose className lands on its wrapper div, not its trigger), or an input with something
 * beside it such as a currency prefix.
 *
 * Deliberately NO fill. The tint on INPUT marks a box you type into; a select or a picker is
 * something you choose from, and colouring those too turns every control into a filled slab.
 *
 * It is `focus-within` rather than `focus` for that reason: the element carrying the border
 * is never the element that takes focus. Carries no padding, since the control inside brings
 * its own and doubling them makes a field visibly taller than its neighbours.
 */
export const FIELD = 'w-full border-b-2 border-primary-500/40 dark:border-primary-400/40 bg-transparent transition-colors focus-within:border-primary-600 dark:focus-within:border-primary-400'

export function Label({ children, className = '', ...rest }) {
  return <label className={`${LABEL} ${className}`} {...rest}>{children}</label>
}

export function Input({ className = '', ...props }) {
  return <input className={`${INPUT} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${INPUT} ${className}`} {...props} />
}

/** Label + control + optional hint/error text. */
export function Field({ label, hint, error, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error
        ? <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
        : hint ? <p className="text-xs text-content-muted mt-1">{hint}</p> : null}
    </div>
  )
}
