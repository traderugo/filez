'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'

/**
 * Searchable select dropdown — replaces plain <select> for lists with many options.
 *
 * The list is PORTALLED to document.body and positioned `fixed`, not `absolute` inside this
 * component. It used to be absolute, which meant any ancestor with a clipping overflow ate it:
 * on the admin Stations table (overflow-x-auto, and setting overflow-x forces overflow-y to
 * auto) the dropdown was clipped to the height of a one-row table cell and rendered as nothing.
 * z-index cannot escape a clipping box, so raising it would not have helped. The symptom was a
 * select that opened onto an empty void, indistinguishable from having no options at all.
 *
 * Consequences of portalling, both handled below: the list is no longer a DOM descendant of
 * containerRef, so the outside-click check has to test it separately or picking an option would
 * close the menu before the click landed; and fixed coordinates are viewport-relative, so they
 * are recomputed on scroll (capture phase, to catch scrolling containers) and on resize.
 *
 * @param {Object}   props
 * @param {string}   props.value        - Currently selected value
 * @param {Function} props.onChange      - Called with new value string
 * @param {Array}    props.options       - [{ value, label }] or [{ value, label, sub }]
 * @param {string}   [props.placeholder] - Placeholder when nothing selected
 * @param {string}   [props.className]  - Additional classes for the container
 * @param {boolean}  [props.disabled]   - Disable the control
 */
export default function SearchableSelect({ value, onChange, options = [], placeholder = 'Select...', className = '', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropUp, setDropUp] = useState(false)
  const [coords, setCoords] = useState(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedOption = options.find(o => String(o.value) === String(value))

  const filtered = search
    ? options.filter(o => {
        const q = search.toLowerCase()
        return (o.label || '').toLowerCase().includes(q) ||
               (o.sub || '').toLowerCase().includes(q)
      })
    : options

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      // The list lives in a portal, so it is not inside containerRef. Without the second test
      // a mousedown on an option would close the menu and unmount it before the click fired.
      const inTrigger = containerRef.current?.contains(e.target)
      const inList = dropdownRef.current?.contains(e.target)
      if (!inTrigger && !inList) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.children[highlightIdx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlightIdx(0) }, [search])

  // Position for the portalled list. Viewport-relative, because the list is `fixed`.
  const recalcDrop = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight
    const spaceBelow = vh - rect.bottom
    // Only flip up when there is genuinely more room above, or a select near the top of a short
    // viewport flips into even less space than it started with.
    const up = spaceBelow < 280 && rect.top > spaceBelow
    setDropUp(up)
    setCoords({
      left: rect.left,
      width: rect.width,
      top: up ? undefined : rect.bottom + 2,
      bottom: up ? vh - rect.top + 2 : undefined,
    })
  }, [])

  // Recalculate while open: on scroll (capture, so scrolling containers count, not just the
  // window), on resize, and on visualViewport resize when the virtual keyboard opens.
  useEffect(() => {
    if (!open) return
    const handler = () => recalcDrop()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    window.visualViewport?.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
      window.visualViewport?.removeEventListener('resize', handler)
    }
  }, [open, recalcDrop])

  const handleOpen = () => {
    if (disabled) return
    if (!open) recalcDrop()
    setOpen(!open)
  }

  const select = useCallback((val) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }, [onChange])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) select(filtered[highlightIdx].value)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="w-full px-3 py-2.5 text-base bg-transparent text-left flex items-center justify-between focus:outline-none focus:bg-primary-500/10 disabled:opacity-50"
      >
        <span className={selectedOption ? 'text-content truncate' : 'text-content-faint truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
          {selectedOption?.sub && <span className="text-content-faint text-xs ml-1">({selectedOption.sub})</span>}
        </span>
        <ChevronDown className="w-4 h-4 text-content-faint flex-shrink-0 ml-1" />
      </button>

      {/* Dropdown, portalled so no ancestor overflow can clip it */}
      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          className="z-50 bg-surface border border-line-strong shadow-lg max-h-64 flex flex-col"
        >
          {/* Search input */}
          <div className={`flex items-center border-b border-line px-2 ${dropUp ? 'order-last border-b-0 border-t' : ''}`}>
            <Search className="w-4 h-4 text-content-faint flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="w-full px-2 py-2 text-sm focus:outline-none bg-transparent text-content placeholder:text-content-faint"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-content-faint hover:text-content-strong">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <ul ref={listRef} className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-content-faint text-center">No matches</li>
            )}
            {filtered.map((opt, idx) => (
              <li
                key={opt.value}
                onClick={() => select(opt.value)}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                  idx === highlightIdx ? 'bg-primary-500/10' : ''
                } ${String(opt.value) === String(value) ? 'font-medium text-primary-700 dark:text-primary-300' : 'text-content-strong'} hover:bg-primary-500/10`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.sub && <span className="text-xs text-content-faint ml-2 flex-shrink-0">{opt.sub}</span>}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
