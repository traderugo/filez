'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShoppingCart, ArrowRight } from 'lucide-react'

export default function SubscribePage() {
  const [services, setServices] = useState([])
  const [selectedItems, setSelectedItems] = useState({})
  const [servicesLoading, setServicesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) {
        setServicesLoading(false)
        return
      }
      const data = await res.json()
      setServices(data.services || [])

      // If there's already a pending_payment subscription, redirect to its pay page
      if (data.subscription?.status === 'pending_payment') {
        router.replace(`/dashboard/subscribe/pay/${data.subscription.id}`)
        return
      }

      setServicesLoading(false)
    }
    load()
  }, [router])

  const toggleItem = (serviceId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }))
  }

  const selectedServices = services.filter((s) => selectedItems[s.id])
  const total = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      // If they already have a pending_payment sub, redirect to it
      if (res.status === 409 && data.existingId) {
        router.push(`/dashboard/subscribe/pay/${data.existingId}`)
        return
      }
      setError(data.error || 'Failed to create subscription')
      return
    }

    // Redirect to payment page
    router.push(`/dashboard/subscribe/pay/${data.subscription.id}`)
  }

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Subscribe</h1>
      <p className="text-sm text-gray-500 mb-8">
        Select your services to get started. You&apos;ll pay via bank transfer next.
      </p>

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
                  className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedItems[svc.id] ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedItems[svc.id]}
                    onChange={() => toggleItem(svc.id)}
                    className="mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
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
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  {total.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                </span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting || selectedServices.length === 0}
            className="w-full bg-orange-600 text-white py-2.5 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
