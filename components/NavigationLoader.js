'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationLoader() {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setProgress(100)
    setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 300)
  }, [])

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setProgress(15)
    setVisible(true)
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(intervalRef.current); return prev }
        const increment = prev < 50 ? 8 : prev < 70 ? 4 : 1
        return Math.min(prev + increment, 90)
      })
    }, 300)
    timeoutRef.current = setTimeout(stop, 12000)
  }, [stop])

  // Navigation completed — finish the bar
  useEffect(() => {
    if (visible) stop()
  }, [pathname, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for clicks on internal links
  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('blob:') ||
        anchor.hasAttribute('download') ||
        anchor.target === '_blank'
      ) return

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const currentPath = window.location.pathname + window.location.search
      const targetPath = href.split('#')[0]

      if (targetPath && targetPath !== currentPath) {
        start()
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [start])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-blue-600 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
