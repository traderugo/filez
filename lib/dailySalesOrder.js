// Daily-sales entries are re-ordered by createdAt when a day is reopened for edit (see the
// loader in the daily-sales page). When several entries are saved in one go the old code stamped
// them all with a single timestamp, so the sort tied and they came back in random record-id
// order — the "entries reorder on reopen" bug. Give each entry a distinct, strictly increasing
// createdAt by its tab position so the saved order survives a reopen.

/**
 * @param {number} baseMs - a base epoch-ms for this save
 * @param {number} index  - the entry's position in the tab order (0-based)
 * @returns {string} an ISO timestamp that strictly increases with index
 */
export function orderedCreatedAt(baseMs, index) {
  return new Date(baseMs + index).toISOString()
}
