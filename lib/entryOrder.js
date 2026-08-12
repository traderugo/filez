// Entry pages re-order a day's entries by createdAt when the day is reopened for edit. When
// several entries are saved in one go the old code stamped them all with a single timestamp, so
// the sort tied and they came back in arbitrary record-id order: the "entries reorder on reopen"
// bug. Give each entry a distinct, strictly increasing createdAt by its position so the saved
// order survives a reopen.
//
// Was lib/dailySalesOrder.js, when daily-sales was the only page that had been fixed. Every
// multi-entry page uses it now, so the daily-sales name was a misnomer.

/**
 * @param {number} baseMs - a base epoch-ms for this save
 * @param {number} index  - the entry's position in the form order (0-based)
 * @returns {string} an ISO timestamp that strictly increases with index
 */
export function orderedCreatedAt(baseMs, index) {
  return new Date(baseMs + index).toISOString()
}

/**
 * The other half of the fix: the comparator every loader sorts a day's entries with.
 *
 * Reads both spellings because records arrive from two places. Dexie holds the camelCase
 * `createdAt` this app writes, while rows pulled from the server can still carry the
 * snake_case `created_at`, and a loader that checked only one would silently sort those to
 * the front as epoch 0.
 */
export function byCreatedAt(a, b) {
  return new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0)
}
