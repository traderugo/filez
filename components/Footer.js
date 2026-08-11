import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-subtle">
      <div className="px-4 py-6 flex flex-col items-center gap-2 text-xs text-content-faint">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/feedback" className="hover:text-content-strong">Feedback</Link>
          <Link href="/auth/login" className="hover:text-content-strong">Login</Link>
        </div>
        <span>&copy; {new Date().getFullYear()} StationMGR</span>
      </div>
    </footer>
  )
}
