'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Fuel, ClipboardList, BarChart3, Users } from 'lucide-react'
import Footer from '@/components/Footer'

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (res.ok) setLoggedIn(true)
    }).catch(() => {})
  }, [])

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-5">
          <img src="/icon-192.png" alt="StationMGR" className="w-14 h-14" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          StationMGR
        </h1>
        <p className="text-base text-gray-500 max-w-md mx-auto">
          Daily sales, lodgements, stock receipts, and reports — all in one place.
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-16">
        {loggedIn ? (
          <Link
            href="/dashboard"
            className="bg-accent text-white px-6 py-2.5 font-medium hover:bg-accent-600 transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="bg-accent text-white px-6 py-2.5 font-medium hover:bg-accent-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/auth/register"
              className="border border-gray-300 text-gray-700 px-6 py-2.5 font-medium hover:bg-gray-50 transition-colors"
            >
              Create Account
            </Link>
          </>
        )}
      </div>

      <div className="border-t border-gray-200 pt-12">
        <div className="grid sm:grid-cols-2 gap-8">
          <div className="flex gap-3">
            <Fuel className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Daily Sales Entry</h3>
              <p className="text-sm text-gray-500">
                Record pump readings, nozzle sales, and tank dips per shift.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ClipboardList className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Lodgements & Receipts</h3>
              <p className="text-sm text-gray-500">
                Track bank lodgements, product receipts, and customer payments.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <BarChart3 className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Reports</h3>
              <p className="text-sm text-gray-500">
                Generate daily sales reports, audit reports, and variance summaries.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Users className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Multi-Station Access</h3>
              <p className="text-sm text-gray-500">
                Invite staff, assign roles, and manage multiple stations from one account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  )
}
