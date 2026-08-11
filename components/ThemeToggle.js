'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

/**
 * Light/dark toggle. Writes the choice to localStorage and flips <html class="dark">,
 * which is what the semantic tokens in globals.css key off. Mirrors the pre-paint script
 * in app/layout.js.
 *
 * NOT MOUNTED YET. Dark mode is only as complete as the screens converted to tokens, and
 * most of station-portal still uses literal bg-white / bg-gray-*. Until that sweep is done
 * this switch would produce a dark header over white pages, which reads as breakage rather
 * than a feature. Mount it in the Header once the screens are converted.
 */
export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
    setDark(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`flex items-center justify-center w-9 h-9 text-content-muted hover:text-content hover:bg-subtle transition-colors ${className}`}
    >
      {/* Avoid a hydration mismatch: render a stable icon until mounted. */}
      {mounted && dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
