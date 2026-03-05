'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, CreditCard, MessageSquare, Loader2, FileSpreadsheet, Droplets, ClipboardList } from 'lucide-react'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { format, differenceInDays } from 'date-fns'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setSubscription(data.subscription)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const daysLeft = subscription?.end_date
    ? differenceInDays(new Date(subscription.end_date), new Date())
    : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome, {profile?.name}</h1>
      <p className="text-sm text-gray-500 mb-8">{profile?.email}</p>

      {/* Subscription status */}
      <div className="border-t border-gray-200 pt-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Subscription</h2>
          {subscription && <SubscriptionBadge status={subscription.status} />}
        </div>

        {subscription?.status === 'active' ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              Expires {format(new Date(subscription.end_date), 'MMM d, yyyy')}
              {daysLeft !== null && daysLeft <= 7 && (
                <span className="text-orange-600 font-medium">({daysLeft} days left)</span>
              )}
            </div>
            {daysLeft !== null && daysLeft <= 7 && (
              <Link href="/dashboard/subscribe" className="inline-flex items-center gap-1 text-orange-600 hover:underline text-sm font-medium">
                <CreditCard className="w-4 h-4" /> Renew now
              </Link>
            )}
          </div>
        ) : subscription?.status === 'pending' ? (
          <p className="text-sm text-yellow-700">Your payment is being reviewed. You&apos;ll be notified once approved.</p>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              {subscription?.status === 'expired' ? 'Your subscription has expired.' : 'You don\'t have an active subscription.'}
            </p>
            <Link
              href="/dashboard/subscribe"
              className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700"
            >
              <CreditCard className="w-4 h-4" /> Subscribe now
            </Link>
          </div>
        )}
      </div>

      {/* Reports */}
      <div className="border-t border-gray-200 pt-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
          <ClipboardList className="w-4 h-4 inline mr-1" />
          Reports
        </h2>
        <div className="grid gap-3">
          <Link
            href="/dashboard/reports/dso"
            className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Daily Sales Operation</p>
              <p className="text-xs text-gray-500">Sales, inventory, consumption, lodgement</p>
            </div>
          </Link>
          <Link
            href="/dashboard/reports/lube"
            className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
          >
            <Droplets className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Lube Logs</p>
              <p className="text-xs text-gray-500">Lubricant sales, inventory, and lodgement</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="border-t border-gray-200 pt-6">
        <Link href="/dashboard/feedback" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <MessageSquare className="w-4 h-4" /> Send feedback
        </Link>
      </div>
    </div>
  )
}
