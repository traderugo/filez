const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Format a YYYY-MM-DD string as "Mon 23rd, Jun 2026"
 */
function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return dateStr
  return `${DAYS[d.getDay()]} ${ordinal(d.getDate())}, ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Short format for column headers: "23 Jun"
 */
function fmtDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d)) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export { fmtDate, fmtDateShort }
