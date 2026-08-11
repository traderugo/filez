/**
 * Shared control styles for the auth screens.
 *
 * These are the design system's underline input and outline button, but written out rather
 * than composed from INPUT / Button in components/ui, for one reason: every auth field has
 * an icon absolutely positioned at left-3, so it needs `pl-10` instead of INPUT_BASE's
 * `px-2`. Composing `${INPUT_BASE} pl-10` would leave both `px-2` and `pl-10` in the class
 * list, and which one wins is decided by their order in the generated stylesheet rather
 * than in the string — the exact trap components/ui warns about.
 *
 * Keep these in step with INPUT_BASE and the Button variants if those change.
 */

/** Underline field sized for a left icon. */
export const AUTH_INPUT =
  'w-full pl-10 pr-4 py-2.5 text-sm bg-primary-500/10 border-b-2 border-primary-500/40 dark:border-primary-400/40 text-content placeholder:text-content-faint transition-colors focus:border-primary-600 dark:focus:border-primary-400 focus:bg-primary-500/15 focus:outline-none'

/** The same field with no icon. */
export const AUTH_INPUT_PLAIN =
  'w-full px-4 py-2.5 text-sm bg-primary-500/10 border-b-2 border-primary-500/40 dark:border-primary-400/40 text-content placeholder:text-content-faint transition-colors focus:border-primary-600 dark:focus:border-primary-400 focus:bg-primary-500/15 focus:outline-none'

/** The emphasised action (Sign in, Create account). Matches Button's `primary` variant. */
export const AUTH_SUBMIT =
  'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30 dark:hover:border-primary-300'

/** Inline text link. */
export const AUTH_LINK = 'text-primary-600 dark:text-primary-300 hover:underline'
