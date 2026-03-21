'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true)
    }

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const installedHandler = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } else {
      setShowGuide(true)
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', '1')
    setDismissed(true)
  }

  if (installed || dismissed) return null

  return (
    <>
      <div className="bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">Install StationMGR</p>
            <p className="text-sm text-gray-600">Install as an app for offline access and faster loading.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Install
          </button>
          <button onClick={handleDismiss} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGuide(false)}>
          <div className="bg-white mx-4 p-5 max-w-sm w-full shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-3">Install StationMGR</h3>
            {isIOS ? (
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button (box with arrow) in Safari</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong></li>
              </ol>
            ) : (
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Tap the <strong>menu</strong> (three dots) in your browser</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong></li>
              </ol>
            )}
            <button
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
