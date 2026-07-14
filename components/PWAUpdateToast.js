'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

// Surfaces a "new version" toast when the service worker updates. AppShell already
// calls reg.update() + activates a waiting worker (SKIP_WAITING), so a new worker
// takes control and fires `controllerchange`. We only toast when a controller was
// already in place (a real update, not the first install), letting the user reload
// to pick up the new code instead of being stuck on the cached bundle.
export default function PWAUpdateToast() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const hadController = !!navigator.serviceWorker.controller
    const onChange = () => { if (hadController) setShow(true) }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-3 bg-white border border-gray-200 shadow-lg px-4 py-3">
        <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-gray-900 flex-1">A new version is available.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Refresh
        </button>
        <button onClick={() => setShow(false)} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
