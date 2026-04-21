'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Building2, Upload, Loader2, CheckCircle, ArrowLeft, Trash2 } from 'lucide-react'

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

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/subscriptions/${id}`)
      if (!res.ok) {
        router.replace('/dashboard/subscribe')
        return
      }
      const { subscription } = await res.json()

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

      {/* Bank details */}
      <div className="border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Bank Details
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Bank</span>
            <span className="text-gray-900 font-medium">Moniepoint MFB</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Account Number</span>
            <span className="text-gray-900 font-medium font-mono">6573945943</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Account Name</span>
            <span className="text-gray-900 font-medium">Premeval Digital Services</span>
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
                Transfer exactly <strong>{Number(sub.total_amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</strong> (₦{sub.verification_suffix} has been deducted as a verification code). This unique amount lets us instantly verify your payment.
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
            <><CheckCircle className="w-4 h-4" />I&apos;ve Paid, Verify Now</>
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
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-800">
            This is an alternative to automatic verification above. Upload a screenshot or receipt of your payment and an admin will manually review and approve it. This is not instant and may take some time.
          </p>
        </div>

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
