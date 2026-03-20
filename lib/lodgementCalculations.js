/**
 * Lodgement calculation helpers for reports.
 *
 * Entries normalised to camelCase:
 *   { salesDate, bankId, lodgementType, amount, createdAt }
 *
 * Bank config objects: { id, bank_name, lodgement_type, opening_balance, opening_date, sort_order }
 */

const LODGEMENT_TYPE_ORDER = ['pos', 'transfer', 'bank_deposit', 'cash', 'other']

/**
 * Sort lodgement entries by salesDate then createdAt.
 */
function sortLodgements(entries) {
  return [...entries].sort((a, b) =>
    (a.salesDate || '').localeCompare(b.salesDate || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )
}

/**
 * Sort banks by lodgement_type order, then alphabetically by bank_name.
 */
function sortBanks(banks) {
  return [...banks].sort((a, b) =>
    (LODGEMENT_TYPE_ORDER.indexOf(a.lodgement_type) - LODGEMENT_TYPE_ORDER.indexOf(b.lodgement_type)) ||
    (a.bank_name || '').localeCompare(b.bank_name || '')
  )
}

/**
 * Generate all YYYY-MM-DD strings from startDate to endDate inclusive.
 */
function getDateRange(startDate, endDate) {
  const pad = (n) => String(n).padStart(2, '0')
  const dates = []
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    d.setDate(d.getDate() + 1)
  }
  return dates
}

/**
 * Calculate lodgement running balances for a date range.
 * Optimized: sorts once, groups by date, carries per-bank closing forward.
 *
 * @param {Array} allLodgements - All lodgement entries
 * @param {Array} banks         - Bank config array
 * @param {string} startDate    - Start date (YYYY-MM-DD)
 * @param {string} endDate      - End date (YYYY-MM-DD)
 * @returns {Object} { dates: [{ date, bankRows, totalPOS, totalTransfer, totalDeposits, totalCash, totalAll, hasEntry, entryCount }], bankIds }
 */
function calculateDateRangeLodgements(allLodgements, banks, startDate, endDate) {
  const sorted = sortLodgements(allLodgements)
  const orderedBanks = sortBanks(banks)
  const bankIds = orderedBanks.map(b => b.id)
  const dateStrings = getDateRange(startDate, endDate)

  // Group sorted entries by salesDate (O(n) scan)
  const entriesByDate = {}
  for (const e of sorted) {
    const d = e.salesDate || ''
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  // Build per-bank opening from config or from entries before range start
  const prevClosing = {}
  for (const bank of orderedBanks) {
    prevClosing[bank.id] = Number(bank.opening_balance || 0)
  }

  // Sum all entries before startDate to get accurate opening
  for (const e of sorted) {
    if (e.salesDate >= startDate) break
    if (prevClosing[e.bankId] !== undefined) {
      prevClosing[e.bankId] += Number(e.amount || 0)
    }
  }

  const dates = dateStrings.map(date => {
    const dayEntries = entriesByDate[date] || []

    // Sum deposits per bank for this day
    const dayAmountByBank = {}
    for (const bank of orderedBanks) {
      dayAmountByBank[bank.id] = 0
    }
    for (const e of dayEntries) {
      if (dayAmountByBank[e.bankId] !== undefined) {
        dayAmountByBank[e.bankId] += Number(e.amount || 0)
      }
    }

    // Build bank rows with opening/deposited/closing
    let totalPOS = 0
    let totalTransfer = 0
    let totalDeposits = 0
    let totalCash = 0
    let totalOther = 0

    const bankRows = orderedBanks.map(bank => {
      const opening = prevClosing[bank.id]
      const deposited = dayAmountByBank[bank.id]
      const closing = opening + deposited

      // Update carry-forward
      prevClosing[bank.id] = closing

      // Accumulate by lodgement type
      switch (bank.lodgement_type) {
        case 'pos': totalPOS += deposited; break
        case 'transfer': totalTransfer += deposited; break
        case 'bank_deposit': totalDeposits += deposited; break
        case 'cash': totalCash += deposited; break
        default: totalOther += deposited; break
      }

      return {
        bankId: bank.id,
        bankName: bank.bank_name,
        terminalId: bank.terminal_id || '',
        lodgementType: bank.lodgement_type,
        opening,
        deposited,
        closing,
      }
    })

    const totalAll = totalPOS + totalTransfer + totalDeposits + totalCash + totalOther

    return {
      date,
      bankRows,
      totalPOS,
      totalTransfer,
      totalDeposits,
      totalCash,
      totalOther,
      totalAll,
      hasEntry: dayEntries.length > 0,
      entryCount: dayEntries.length,
    }
  })

  return { dates, bankIds }
}

export {
  sortLodgements,
  sortBanks,
  calculateDateRangeLodgements,
}
