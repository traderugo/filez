'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShoppingCart, ArrowRight, Fuel, Calendar } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <SubscribeContent />
    </Suspense>
  )
}

function SubscribeContent() {
  const [services, setServices] = useState([])
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState('')
  const [selectedItems, setSelectedItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialOrgId = searchParams.get('org_id') || ''

  useEffect(() => {
    const load = async () => {
      const url = initialOrgId
        ? `/api/dashboard/data?org_id=${initialOrgId}`
        : '/api/dashboard/data'
      const res = await fetch(url)
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      setServices(data.services || [])
      setStations(data.stations || [])
      setSubscription(data.subscription || null)

      // Pre-select station from URL param or first station
      const orgId = initialOrgId || data.stations?.[0]?.id || ''
      setSelectedStation(orgId)

      // If there's already a pending_payment subscription for this station, redirect to its pay page
      if (data.subscription?.status === 'pending_payment') {
        router.replace(`/dashboard/subscribe/pay/${data.subscription.id}`)
        return
      }

      setLoading(false)
    }
    load()
  }, [router, initialOrgId])

  // When station changes, re-fetch subscription for that station
  const handleStationChange = async (orgId) => {
    setSelectedStation(orgId)
    setSubscription(null)
    setError('')

    if (!orgId) return

    const res = await fetch(`/api/dashboard/data?org_id=${orgId}`)
    if (!res.ok) return
    const data = await res.json()
    setSubscription(data.subscription || null)

    if (data.subscription?.status === 'pending_payment') {
      router.replace(`/dashboard/subscribe/pay/${data.subscription.id}`)
    }
  }

  const toggleItem = (serviceId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }))
  }

  const selectedServices = services.filter((s) => selectedItems[s.id])
  const monthlyTotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)
  const total = monthlyTotal * months

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedStation) {
      setError('Please select a station')
      return
    }
    if (selectedServices.length === 0) {
      setError('Please select at least one service')
      return
    }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: selectedStation,
        months,
        total_amount: total,
        items: selectedServices.map((s) => ({
          service_id: s.id,
          service_name: s.name,
          price: Number(s.price),
        })),
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      if (res.status === 409 && data.existingId) {
        router.push(`/dashboard/subscribe/pay/${data.existingId}`)
        return
      }
      setError(data.error || 'Failed to create subscription')
      return
    }

    router.push(`/dashboard/subscribe/pay/${data.subscription.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Show active subscription info
  const hasApproved = subscription?.status === 'approved'
  const hasPendingApproval = subscription?.status === 'pending_approval'

  return (
    <div className="max-w-lg px-4 sm:px-8 py-8">
      <p className="text-sm text-gray-500 mb-8">
        Select your station and services to get started. You&apos;ll pay via bank transfer next.
      </p>

      {/* Station selector */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4" /> Station
        </h2>
        {stations.length === 0 ? (
          <p className="text-sm text-gray-500">You don&apos;t own any stations yet.</p>
        ) : stations.length === 1 ? (
          <div className="border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-gray-900">
            {stations[0].name}
          </div>
        ) : (
          <div className="border border-gray-300">
            <SearchableSelect
              value={selectedStation}
              onChange={(val) => handleStationChange(val)}
              options={stations.map((st) => ({ value: st.id, label: st.name }))}
              placeholder="Select a station..."
            />
          </div>
        )}
      </div>

      {/* Subscription status for selected station */}
      {hasApproved && (
        <div className="bg-green-50 border border-green-200 px-4 py-3 mb-6 text-sm text-green-800">
          This station has an active subscription (expires {subscription.end_date}).
        </div>
      )}
      {hasPendingApproval && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 mb-6 text-sm text-blue-800">
          This station has a subscription awaiting admin approval.
        </div>
      )}

      {services.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No services available yet.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Select Services
            </h2>
            <div className="space-y-2">
              {services.map((svc) => (
                <label
                  key={svc.id}
                  className={`flex items-start gap-3 border p-3 cursor-pointer transition-colors ${
                    selectedItems[svc.id] ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedItems[svc.id]}
                    onChange={() => toggleItem(svc.id)}
                    className="mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                    {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {Number(svc.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                  </span>
                </label>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <>
                {/* Duration */}
                <div className="mt-6">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Duration
                  </h2>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={months}
                      onChange={(e) => setMonths(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                      className="w-20 border border-gray-300 px-3 py-2 text-sm text-center font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-600">month{months !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    {months > 1 && (
                      <span className="text-xs text-gray-400 ml-2">
                        ({monthlyTotal.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} × {months} months)
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {total.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                  </span>
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting || selectedServices.length === 0 || !selectedStation || hasApproved || hasPendingApproval}
            className="w-full bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Continue to payment
          </button>
        </form>
      )}
    </div>
  )
}
