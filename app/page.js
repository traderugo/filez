import Link from 'next/link'
import { FolderOpen, FileSpreadsheet, Shield, Clock } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
          <FolderOpen className="w-7 h-7 text-blue-600" />
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
        Your Files, Organized
      </h1>
      <p className="text-lg text-gray-500 mb-10 max-w-lg mx-auto">
        Access your custom reports and documents anytime. Subscribe monthly, get your files delivered.
      </p>

      <div className="flex justify-center gap-3 mb-16">
        <Link
          href="/auth/register"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/auth/login"
          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-md font-medium hover:bg-gray-50 transition-colors"
        >
          Log in
        </Link>
      </div>

      <div className="border-t border-gray-200 pt-12">
        <div className="grid sm:grid-cols-3 gap-8 text-left">
          <div>
            <FileSpreadsheet className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Custom Files</h3>
            <p className="text-sm text-gray-500">
              Your data in ready-to-use spreadsheets, updated and assigned by our team.
            </p>
          </div>
          <div>
            <Shield className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Secure Access</h3>
            <p className="text-sm text-gray-500">
              Your files are private. Only you and admins can see your assigned documents.
            </p>
          </div>
          <div>
            <Clock className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Simple Subscription</h3>
            <p className="text-sm text-gray-500">
              Pay monthly via bank transfer, upload your proof, and get approved within hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
