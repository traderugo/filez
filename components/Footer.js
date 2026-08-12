import Link from 'next/link'
import PremevalLogo from '@/components/PremevalLogo'

/**
 * `app` is the signed-in variant, rendered by AppShell at the foot of every dashboard screen.
 *
 * It drops the link row. Login is plainly wrong once you are signed in, and Feedback is
 * already a quick link on the station picker and reachable from the header, so repeating it
 * on all thirty screens is noise. What is left is the copyright and the Premeval line, which
 * is the whole point of putting a footer there.
 */
export default function Footer({ app = false }) {
  return (
    <footer className="border-t border-line bg-subtle">
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-xs text-content-faint">
        {!app && (
          <div className="flex items-center gap-4">
            <Link href="/dashboard/feedback" className="hover:text-content-strong">Feedback</Link>
            <Link href="/auth/login" className="hover:text-content-strong">Login</Link>
          </div>
        )}
        <span>&copy; {new Date().getFullYear()} StationMGR</span>

        {/* One mark in both themes. The blue "p" and its orange dot are the brand's own
            colours, not palette tokens, so they stay put rather than swapping with the theme. */}
        <span className="flex items-center gap-1.5 mt-1">
          Powered by
          <PremevalLogo className="w-4 h-4" />
          <span className="font-semibold text-content-muted">Premeval Digital</span>
        </span>
      </div>
    </footer>
  )
}
