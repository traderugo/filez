'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { OUTLINE } from '@/components/ui'

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
      <div className="flex items-center gap-3 bg-surface border-card border-line shadow-lg px-4 py-3">
        <RefreshCw className="w-4 h-4 text-primary-600 dark:text-primary-300 flex-shrink-0" />
        <p className="text-sm text-content flex-1">A new version is available.</p>
        {/* Was a solid blue fill; the system has no solid CTAs. Padding and text size are
            unchanged, so the toast keeps its height. */}
        <button
          onClick={() => window.location.reload()}
          className={`px-3 py-1.5 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
        >
          Refresh
        </button>
        <button onClick={() => setShow(false)} aria-label="Dismiss" className="p-1 text-content-faint hover:text-content-strong">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
