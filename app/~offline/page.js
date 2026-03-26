'use client'

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-gray-900 mb-1">You are offline</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Check your internet connection and try again. Your data is safe locally.
      </p>
      <button
        onClick={() => typeof window !== 'undefined' && window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  )
}
