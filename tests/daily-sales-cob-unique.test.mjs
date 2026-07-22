/**
 * A station day may have multiple shift entries but only ONE close-of-business entry. This pins
 * that rule (cobDuplicateMessage) — the guard the daily-sales POST/PATCH use to reject a second
 * close-of-business BEFORE it can become a duplicate row on the server. Duplicate close-of-
 * business rows (from a day entered twice off a stale device) are exactly what corrupted the
 * reports; the server must refuse the second one.
 *
 * Source is loaded and evaluated (no import) so the test cannot drift from the implementation.
 *
 * Run: node tests/daily-sales-cob-unique.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(__dirname, '..', 'lib', 'dailySalesGuards.js'), 'utf8').replace(/export\s+/g, '')
const { cobDuplicateMessage } = new Function(`${src}\nreturn { cobDuplicateMessage }`)()

let failures = 0
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`); if (!ok) failures++ }
const DUP = 'A close-of-business entry already exists for this date.'

console.log('\ncobDuplicateMessage — one close-of-business per day')
// The bug: a second close-of-business for a date that already has one must be refused.
check('BLOCKS a second close-of-business on a date that already has one', cobDuplicateMessage(true, true) === DUP)
// Everything else is allowed:
check('allows the first close-of-business (none exists yet)', cobDuplicateMessage(true, false) === null)
check('allows extra non-close-of-business shift entries (multiple shifts permitted)', cobDuplicateMessage(false, true) === null)
check('allows a plain shift when no conflict', cobDuplicateMessage(false, false) === null)

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
