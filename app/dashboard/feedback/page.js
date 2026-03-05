'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2, CheckCircle } from 'lucide-react'

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) {
      setError('Please select a rating')
      return
    }
    if (!message.trim()) {
      setError('Please write a message')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, message: message.trim() }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to submit')
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h1>
        <p className="text-sm text-gray-500 mb-6">Your feedback has been submitted.</p>
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
      <h1 className="text-xl font-bold text-gray-900 mb-1">Feedback</h1>
      <p className="text-sm text-gray-500 mb-8">Let us know how we can improve.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="p-1"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    n <= (hovered || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you think..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-orange-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit feedback
        </button>
      </form>
    </div>
  )
}
