// A station's day may have several shift entries, but only ONE close-of-business entry.
//
// Duplicate-prevention for daily sales was done only on the client against the local Dexie
// mirror, which can be stale on an offline/out-of-date device. That let a device create a second
// close-of-business row for a day it couldn't see, producing the duplicate daily-sales rows.
// This guard is enforced on the SERVER (backed by a unique DB index) so a stale client cannot
// bypass it. Multiple non-close-of-business shift entries per day remain allowed.

/**
 * Returns an error message if saving this entry would create a SECOND live close-of-business
 * entry for its date, or null if the save is allowed.
 *
 * @param {boolean} isCob         - is the entry being saved marked close-of-business?
 * @param {boolean} otherCobExists - does another (different id) live close-of-business entry
 *                                    already exist for the same (org_id, entry_date)?
 */
export function cobDuplicateMessage(isCob, otherCobExists) {
  if (isCob && otherCobExists) return 'A close-of-business entry already exists for this date.'
  return null
}
