'use client'

import { useState, useEffect } from 'react'
import { Clock, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Loader2 } from 'lucide-react'

/**
 * Top-of-hub card, in the slot and skin store-portal's BusinessWallet occupies: the one accent
 * surface on the page — solid brand blue, white text, a thin white divider above a bottom strip
 * that carries the sync controls.
 *
 * store's hero figure is money (lodgement balance). A station hub has no money figure of its
 * own, so the hero here is the number that actually governs the working day: how many entries
 * are waiting to be pushed. Nothing is invented — the station identity, the pending count and
 * the consolidation countdown were all already on this page, scattered between a bare heading
 * and a floating button row.
 *
 * The pip is literal white because it sits ON a filled coloured surface, where a surface token
 * would resolve to the page background and vanish. rounded-full is intended — the square-corner
 * rule exempts pills.
 */
const COUNT_PIP = 'bg-white/25 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center' // design-exception

function nextConsolidation() {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0))
  let daysToAdd = (7 - now.getUTCDay()) % 7
  if (daysToAdd === 0 && now >= next) daysToAdd = 7
  next.setUTCDate(next.getUTCDate() + daysToAdd)
  return next
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

export default function StationWallet({
  station, pendingCount, syncing, refreshing, onPush, onPull, onClear,
}) {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(nextConsolidation() - new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const allSynced = pendingCount === 0
  // On a filled surface every control is white-on-blue; the app's blue outline would disappear.
  const btn = 'flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold border-2 border-white/40 text-white hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  return (
    <div className="relative bg-primary-600 text-white border-card border-primary-500/40 dark:border-primary-400/40 mb-4">
      <div className="relative p-3">
        <h1 className="text-sm font-semibold text-white truncate mb-1">{station.name}</h1>
        {(station.location || station.station_group) && (
          <p className="text-xs text-white/80 truncate mb-1">
            {[station.location, station.station_group].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-white uppercase tracking-wide mb-0.5">
          <RefreshCw className="w-3.5 h-3.5" /> {allSynced ? 'Sync status' : 'Waiting to push'}
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {allSynced ? 'All synced' : `${pendingCount} pending`}
        </p>
        {countdown && (
          <p className="flex items-center gap-1.5 text-sm text-white/90 mt-1">
            <Clock className="w-4 h-4" /> Next consolidation in{' '}
            <span className="font-mono font-semibold text-white">{countdown}</span>
          </p>
        )}
      </div>

      {/* Same split as store-portal's SyncStatus strip: the quiet control on the left, the two
          sync buttons together on the right. No "N pending" text beside Clear, unlike store's
          version, because this card already carries that count as its hero figure just above.
          justify-between keeps the buttons at the right edge even when Clear is absent. */}
      <div className="relative border-t border-white/30 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {pendingCount > 0 && (
            <button onClick={onClear} className="text-xs font-semibold text-white/80 hover:text-white underline">
              Clear queue
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onPush} disabled={syncing || allSynced} className={btn}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
            Push
            {pendingCount > 0 && <span className={COUNT_PIP}>{pendingCount > 9 ? '9+' : pendingCount}</span>}
          </button>
          <button onClick={onPull} disabled={refreshing} className={btn}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
            Pull
          </button>
        </div>
      </div>
    </div>
  )
}
