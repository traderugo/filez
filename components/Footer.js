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

        {/*
          Two copies of the mark, one shown per theme. The default variant is the blue "p",
          which reads on a light panel; `dark` is the white "p" with the same orange dot, for
          the dark surface. A single copy would have to pick one and be wrong in the other
          theme, and the mark's colours are deliberately its own constants rather than the UI
          palette, so they cannot be swapped with a token.
        */}
        <span className="flex items-center gap-1.5 mt-1">
          Powered by
          <PremevalLogo className="w-4 h-4 dark:hidden" />
          <PremevalLogo variant="dark" className="w-4 h-4 hidden dark:block" />
          <span className="font-semibold text-content-muted">Premeval Digital</span>
        </span>
      </div>
    </footer>
  )
}
