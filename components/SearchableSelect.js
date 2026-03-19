'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

/**
 * Searchable select dropdown — replaces plain <select> for lists with many options.
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
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

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
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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

  const recalcDrop = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight
    const spaceBelow = vh - rect.bottom
    setDropUp(spaceBelow < 280)
  }, [])

  // Recalculate when virtual keyboard opens/closes
  useEffect(() => {
    if (!open || !window.visualViewport) return
    const vv = window.visualViewport
    const handler = () => recalcDrop()
    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
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
        className="w-full px-3 py-2.5 text-base bg-transparent text-left flex items-center justify-between focus:outline-none focus:bg-blue-50 disabled:opacity-50"
      >
        <span className={selectedOption ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
          {selectedOption?.sub && <span className="text-gray-400 text-xs ml-1">({selectedOption.sub})</span>}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 left-0 right-0 bg-white border border-gray-300 shadow-lg max-h-64 flex flex-col ${
          dropUp ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
        }`}>
          {/* Search input */}
          <div className={`flex items-center border-b border-gray-200 px-2 ${dropUp ? 'order-last border-b-0 border-t' : ''}`}>
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="w-full px-2 py-2 text-sm focus:outline-none bg-transparent"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <ul ref={listRef} className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">No matches</li>
            )}
            {filtered.map((opt, idx) => (
              <li
                key={opt.value}
                onClick={() => select(opt.value)}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                  idx === highlightIdx ? 'bg-blue-50' : ''
                } ${String(opt.value) === String(value) ? 'font-medium text-blue-700' : 'text-gray-800'} hover:bg-blue-50`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.sub && <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{opt.sub}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
