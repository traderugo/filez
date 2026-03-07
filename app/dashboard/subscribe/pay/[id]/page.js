'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Building2, Upload, Loader2, CheckCircle, Clock, Copy, Check, XCircle, ArrowLeft, Trash2 } from 'lucide-react'

function formatCountdown(ms) {
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export default function PaymentPage() {
  const { id } = useParams()
  const router = useRouter()

  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [reference, setReference] = useState('')
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Load subscription data
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      const subscription = data.subscription

      if (!subscription || subscription.id !== id) {
        router.replace('/dashboard/subscribe')
        return
      }

      if (subscription.status === 'pending_approval') {
        setDone(true)
      } else if (subscription.status !== 'pending_payment') {
        router.replace('/dashboard')
        return
      }

      setSub(subscription)
      setLoading(false)
    }
    load()
  }, [id, router])

  // Countdown timer
  useEffect(() => {
    if (!sub?.payment_deadline) return

    const tick = () => {
      const remaining = new Date(sub.payment_deadline).getTime() - Date.now()
      setCountdown(remaining)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [sub?.payment_deadline])

  const copyRef = useCallback(() => {
    if (!sub?.reference_code) return
    navigator.clipboard.writeText(sub.reference_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sub?.reference_code])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please upload your payment proof')
      return
    }
    setUploading(true)
    setError('')

    // 1. Upload file
    const formData = new FormData()
    formData.append('file', file)
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
    const uploadData = await uploadRes.json()

    if (!uploadRes.ok) {
      setUploading(false)
      setError(uploadData.error || 'Upload failed')
      return
    }

    // 2. Submit proof
    const proofRes = await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof_url: uploadData.url,
        payment_reference: reference.trim(),
      }),
    })

    const proofData = await proofRes.json()
    setUploading(false)

    if (!proofRes.ok) {
      setError(proofData.error || 'Failed to submit proof')
      return
    }

    setDone(true)
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this subscription? You can create a new one after.')) return
    setCancelling(true)
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.replace('/dashboard/subscribe')
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to cancel')
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proof submitted</h1>
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

  const isExpired = countdown !== null && countdown <= 0

  if (isExpired) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Payment deadline passed</h1>
        <p className="text-sm text-gray-500 mb-6">
          The 48-hour payment window has expired. Please create a new subscription.
        </p>
        <button
          onClick={() => router.push('/dashboard/subscribe')}
          className="bg-orange-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-orange-700"
        >
          Subscribe again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-1">Complete Payment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Transfer the amount below, then upload your proof of payment.
      </p>

      {/* Countdown */}
      {countdown !== null && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md px-4 py-3 mb-6">
          <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-yellow-800 font-medium">Payment deadline: </span>
            <span className="text-yellow-700 font-mono">{formatCountdown(countdown)}</span>
          </div>
        </div>
      )}

      {/* Reference code */}
      {sub?.reference_code && (
        <div className="bg-orange-50 border border-orange-200 rounded-md px-4 py-3 mb-6">
          <p className="text-xs text-orange-600 font-medium mb-1">Use this as your transfer narration</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-orange-800">{sub.reference_code}</span>
            <button onClick={copyRef} className="p-1 text-orange-600 hover:text-orange-700">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Bank details */}
      <div className="border border-gray-200 rounded-md p-4 mb-6">
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
          {sub?.total_amount != null && (
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Amount to pay</span>
              <span className="text-gray-900 font-bold">
                {Number(sub.total_amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Upload proof form */}
      <div className="border border-gray-200 rounded-md p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload Proof
        </h2>

        <form onSubmit={handleUpload} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Proof of payment</label>
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
            disabled={uploading || !file}
            className="w-full bg-orange-600 text-white py-2.5 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit proof
          </button>
        </form>
      </div>

      {/* Cancel */}
      <button
        onClick={handleCancel}
        disabled={cancelling}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-600"
      >
        {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Cancel subscription
      </button>
    </div>
  )
}
