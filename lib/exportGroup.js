/**
 * Which station group gets its own bespoke Excel exports.
 *
 * Several reports ship two workbooks: a replica of Rainoil's own paper form, and a plain one
 * for everyone else. The audit pack, the product receipt certificate and the imprest sheet are
 * all replicas, down to hardcoded palettes, Corbel, and in the audit's case their logo.
 *
 * The rule lives here rather than in each report, because three copies of a string comparison
 * is three places for it to drift, and the drift would be silent: a station would simply get
 * the wrong workbook.
 *
 * Matched on the group NAME, which means renaming the group in admin moves those stations onto
 * the plain exports. That is the trade for having no migration behind this. If a third format
 * ever appears, put the choice on the group row instead of here.
 */
export const RAINOIL_GROUP = 'RAINOIL'

/** Trimmed and case-insensitive, because this is a name an admin types into a form. */
export function isRainoilGroup(groupName) {
  return (groupName || '').trim().toUpperCase() === RAINOIL_GROUP
}
