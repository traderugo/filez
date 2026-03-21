const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n) { return String(n).padStart(2, '0') }

/**
 * Parse a date string or Date object into a Date.
 * YYYY-MM-DD strings get 'T00:00:00' appended to avoid timezone shift.
 * ISO timestamps and Date objects are used as-is.
 */
function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return input
  // YYYY-MM-DD (10 chars, no T) — append time to avoid UTC shift
  if (typeof input === 'string' && input.length === 10 && input[4] === '-') {
    return new Date(input + 'T00:00:00')
  }
  return new Date(input)
}

/**
 * Format as "Sun 08-03-2026".
 * Accepts YYYY-MM-DD string, ISO timestamp, or Date object.
 */
function fmtDate(input) {
  if (!input) return ''
  const d = toDate(input)
  if (isNaN(d)) return String(input)
  return `${DAYS[d.getDay()]} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

/**
 * Short format: "Sun 08-03"
 */
function fmtDateShort(input) {
  if (!input) return ''
  const d = toDate(input)
  if (isNaN(d)) return String(input)
  return `${DAYS[d.getDay()]} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}`
}

export { fmtDate, fmtDateShort }
