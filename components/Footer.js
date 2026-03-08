import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
        <span>&copy; {new Date().getFullYear()} StationVA</span>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/feedback" className="hover:text-gray-600">Feedback</Link>
          <Link href="/auth/login" className="hover:text-gray-600">Login</Link>
        </div>
      </div>
    </footer>
  )
}
