'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileSpreadsheet, ExternalLink, Clock, CreditCard, MessageSquare, Loader2, Lock, Briefcase, ClipboardList } from 'lucide-react'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { formatDistanceToNow, format, differenceInDays } from 'date-fns'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [customData, setCustomData] = useState([])
  const [services, setServices] = useState([])

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setSubscription(data.subscription)
      setFiles(data.files || [])
      setCustomData(data.customData || [])
      setServices(data.services || [])
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

      {/* Custom Info */}
      {customData.length > 0 && (
        <div className="border-t border-gray-200 pt-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            <ClipboardList className="w-4 h-4 inline mr-1" />
            Your Info
          </h2>
          <div className="space-y-2">
            {customData.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-gray-500">{item.label}:</span>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="border-t border-gray-200 pt-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            <Briefcase className="w-4 h-4 inline mr-1" />
            Available Services
          </h2>
          <div className="space-y-3">
            {services.map((svc) => (
              <div key={svc.id} className="border border-gray-200 rounded-md p-3">
                <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                {svc.description && <p className="text-xs text-gray-500 mt-1">{svc.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div className="border-t border-gray-200 pt-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Your Files</h2>

        {subscription?.status !== 'active' ? (
          <div className="text-center py-8">
            <Lock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">
              {subscription?.status === 'expired'
                ? 'Your subscription has expired. Renew to access your files.'
                : 'Subscribe to access your files.'}
            </p>
            <Link
              href="/dashboard/subscribe"
              className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700"
            >
              <CreditCard className="w-4 h-4" />
              {subscription?.status === 'expired' ? 'Renew subscription' : 'Subscribe now'}
            </Link>
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-500">No files assigned yet. Files will appear here once an admin assigns them.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {files.filter((file) => file.share_link?.startsWith('https://')).map((file) => (
              <a
                key={file.id}
                href={file.share_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                  {file.description && (
                    <p className="text-xs text-gray-500 truncate">{file.description}</p>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
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
