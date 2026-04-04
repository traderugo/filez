'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Building2, Upload, Loader2, CheckCircle, Clock, Copy, Check, XCircle, ArrowLeft, Trash2, RefreshCw } from 'lucide-react'

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
  const [verifying, setVerifying] = useState(false)
  const [verifyCooldown, setVerifyCooldown] = useState(0)
  const [verifyResult, setVerifyResult] = useState(null)

  // Verify button cooldown (10s) — same as WaCart
  useEffect(() => {
    if (verifyCooldown <= 0) return
    const timer = setTimeout(() => setVerifyCooldown(verifyCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [verifyCooldown])

  // Verify bank payment — same pattern as WaCart
  const handleVerifyPayment = async () => {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await fetch(`/api/subscriptions/${id}/verify-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (data.verified) {
        setVerifyResult({ type: 'success', message: data.message })
        setSub(prev => ({ ...prev, status: 'approved' }))
        setDone(true)
      } else {
        setVerifyResult({
          type: 'info',
          message: data.message || data.error || 'No matching payment found yet.',
        })
      }
    } catch {
      setVerifyResult({ type: 'error', message: 'Verification failed. Please try again.' })
    } finally {
      setVerifying(false)
      setVerifyCooldown(10)
    }
  }

  // Load subscription data — first fetch the subscription directly to get org_id
  useEffect(() => {
    const load = async () => {
      // Try fetching without org_id first to find the subscription
      // Then use its org_id for proper filtering
      let res = await fetch('/api/dashboard/data')
      if (!res.ok) {
        setLoading(false)
        return
      }
      let data = await res.json()
      let subscription = data.subscription

      // If subscription doesn't match, try finding it across all stations
      if (!subscription || subscription.id !== id) {
        // Check all user's stations for this subscription
        const stations = data.stations || []
        for (const st of stations) {
          const stRes = await fetch(`/api/dashboard/data?org_id=${st.id}`)
          if (!stRes.ok) continue
          const stData = await stRes.json()
          if (stData.subscription?.id === id) {
            subscription = stData.subscription
            break
          }
        }
      }

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
      <div className="max-w-sm px-4 sm:px-8 py-20 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proof submitted</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your payment is being reviewed. You&apos;ll get access once an admin approves it.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-blue-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-blue-700"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  const isExpired = countdown !== null && countdown <= 0

  if (isExpired) {
    return (
      <div className="max-w-sm px-4 sm:px-8 py-20 text-center">
        <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Payment deadline passed</h1>
        <p className="text-sm text-gray-500 mb-6">
          The 48-hour payment window has expired. Please create a new subscription.
        </p>
        <button
          onClick={() => router.push('/dashboard/subscribe')}
          className="bg-blue-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-blue-700"
        >
          Subscribe again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg px-4 sm:px-8 py-8">
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
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-3 mb-6">
          <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-yellow-800 font-medium">Payment deadline: </span>
            <span className="text-yellow-700 font-mono">{formatCountdown(countdown)}</span>
          </div>
        </div>
      )}

      {/* Reference code */}
      {sub?.reference_code && (
        <div className="bg-orange-50 border border-orange-200 px-4 py-3 mb-6">
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
      <div className="border border-gray-200 p-4 mb-6">
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
            <span className="text-gray-900 font-medium">StationMGR</span>
          </div>
          {sub?.total_amount != null && (
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Amount to pay</span>
              <span className="text-gray-900 font-bold">
                {Number(sub.total_amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
              </span>
            </div>
          )}
          {sub?.verification_suffix && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                Transfer exactly <strong>{Number(sub.total_amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</strong> (includes ₦{sub.verification_suffix} verification code). This unique amount lets us instantly verify your payment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Step 1: Verify Payment */}
      <div className="border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
          Verify Payment
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          After transferring the exact amount above, click the button below. We&apos;ll automatically check our bank for your payment.
        </p>
        <button
          onClick={handleVerifyPayment}
          disabled={verifying || verifyCooldown > 0}
          className="w-full bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {verifying ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Checking...</>
          ) : verifyCooldown > 0 ? (
            <>Try again in {verifyCooldown}s</>
          ) : (
            <><CheckCircle className="w-4 h-4" />I&apos;ve Paid — Verify Now</>
          )}
        </button>
        {verifyResult && (
          <div className={`mt-3 p-3 text-sm ${
            verifyResult.type === 'success' ? 'bg-green-50 text-green-700' :
            verifyResult.type === 'error' ? 'bg-red-50 text-red-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {verifyResult.message}
          </div>
        )}
      </div>

      {/* Step 2: Upload proof form (fallback) */}
      <div className="border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Or Upload Proof
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
              className="w-full px-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proof of payment</label>
            <label className="flex items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 transition-colors">
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
            className="w-full bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
