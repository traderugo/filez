'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Upload, Loader2, CheckCircle, Building2, ShoppingCart } from 'lucide-react'
import { supabase, getClientUser } from '@/lib/supabaseClient'

export default function SubscribePage() {
  const [file, setFile] = useState(null)
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Org services
  const [services, setServices] = useState([])
  const [selectedItems, setSelectedItems] = useState({})
  const [orgPlanType, setOrgPlanType] = useState('recurring')
  const [servicesLoading, setServicesLoading] = useState(true)

  useEffect(() => {
    const loadServices = async () => {
      const u = await getClientUser()
      if (!u) return

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', u.id)
        .single()

      if (!profile?.org_id) {
        setServicesLoading(false)
        return
      }

      const [orgRes, servicesRes] = await Promise.all([
        supabase.from('organizations').select('plan_type').eq('id', profile.org_id).single(),
        supabase.from('org_services').select('id, name, description, price').eq('org_id', profile.org_id).order('sort_order'),
      ])

      if (orgRes.data?.plan_type) setOrgPlanType(orgRes.data.plan_type)
      setServices(servicesRes.data || [])
      setServicesLoading(false)
    }
    loadServices()
  }, [])

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
    if (!file) {
      setError('Please upload your payment proof')
      return
    }
    if (services.length > 0 && selectedServices.length === 0) {
      setError('Please select at least one service')
      return
    }
    setLoading(true)
    setError('')

    // 1. Upload proof
    const formData = new FormData()
    formData.append('file', file)
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
    const uploadData = await uploadRes.json()

    if (!uploadRes.ok) {
      setLoading(false)
      setError(uploadData.error || 'Upload failed')
      return
    }

    // 2. Create subscription with selected items
    const subRes = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_reference: reference.trim(),
        proof_url: uploadData.url,
        plan_type: orgPlanType,
        total_amount: total,
        items: selectedServices.map((s) => ({
          service_id: s.id,
          service_name: s.name,
          price: Number(s.price),
        })),
      }),
    })

    const subData = await subRes.json()
    setLoading(false)

    if (!subRes.ok) {
      setError(subData.error || 'Subscription failed')
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Subscription submitted</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your payment is being reviewed. You&apos;ll get access once an admin approves it.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-orange-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-orange-700"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Subscribe</h1>
      <p className="text-sm text-gray-500 mb-8">
        {orgPlanType === 'one_time' ? 'Select your services and make a one-time payment.' : 'Select your services, make a bank transfer, then upload your proof below.'}
      </p>

      {/* Service selection */}
      {!servicesLoading && services.length > 0 && (
        <div className="border-t border-gray-200 pt-6 mb-8">
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

          {/* Total */}
          {selectedServices.length > 0 && (
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Total{orgPlanType === 'recurring' ? '/month' : ''}</span>
              <span className="text-lg font-bold text-gray-900">
                {total.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bank details */}
      <div className="border-t border-gray-200 pt-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Bank Details
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Bank</span>
            <span className="text-gray-900 font-medium">First Bank of Nigeria</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Account Number</span>
            <span className="text-gray-900 font-medium font-mono">0123456789</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Account Name</span>
            <span className="text-gray-900 font-medium">FilePortal Ltd</span>
          </div>
          {selectedServices.length > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Amount to pay</span>
              <span className="text-gray-900 font-bold">
                {total.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Upload form */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Payment Proof
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TRF-123456"
              maxLength={100}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload proof</label>
            <label className="flex items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-orange-400 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">
                {file ? file.name : 'Click to upload (image or PDF)'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white py-2.5 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit {orgPlanType === 'one_time' ? 'payment' : 'subscription'}
          </button>
        </form>
      </div>
    </div>
  )
}
