// In-memory sliding window rate limiter
const store = new Map()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of store) {
    const valid = timestamps.filter((t) => now - t < 15 * 60 * 1000)
    if (valid.length === 0) store.delete(key)
    else store.set(key, valid)
  }
}, 5 * 60 * 1000)

/**
 * @param {string} key - Unique key (e.g. IP or user ID)
 * @param {number} limit - Max requests allowed in the window
 * @param {number} [windowMs=900000] - Window size in ms (default 15 min)
 * @returns {{ success: boolean, remaining: number }}
 */
export function rateLimit(key, limit, windowMs = 15 * 60 * 1000) {
  const now = Date.now()
  const timestamps = (store.get(key) || []).filter((t) => now - t < windowMs)

  if (timestamps.length >= limit) {
    return { success: false, remaining: 0 }
  }

  timestamps.push(now)
  store.set(key, timestamps)
  return { success: true, remaining: limit - timestamps.length }
}
