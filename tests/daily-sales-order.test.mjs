/**
 * Reproduces the "entries reorder when saved and reopened" bug and pins the fix.
 *
 * The daily-sales page loads a day's entries and sorts them by createdAt. Saving several entries
 * in one go used to stamp them all with the SAME timestamp, so the sort tied and they reopened in
 * arbitrary record-id order. orderedCreatedAt gives each a distinct, increasing timestamp by tab
 * position, so sorting by createdAt restores the order the user arranged.
 *
 * Source is loaded and evaluated (no import) so the test cannot drift from the implementation.
 *
 * Run: node tests/daily-sales-order.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(__dirname, '..', 'lib', 'dailySalesOrder.js'), 'utf8').replace(/export\s+/g, '')
const { orderedCreatedAt } = new Function(`${src}\nreturn { orderedCreatedAt }`)()

let failures = 0
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`); if (!ok) failures++ }

const BASE = 1_700_000_000_000

console.log('\ndaily-sales entry ordering')

// The bug: a single shared timestamp ties, so createdAt cannot express order.
const shared = ['a', 'b', 'c'].map((id) => new Date(BASE).toISOString())
check('shared-timestamp save ties on createdAt (the bug condition)', new Set(shared).size === 1)

// The fix: distinct, strictly increasing timestamps by tab position.
const stamped = ['a', 'b', 'c'].map((id, i) => ({ id, pos: i, createdAt: orderedCreatedAt(BASE, i) }))
check('orderedCreatedAt yields distinct timestamps', new Set(stamped.map((e) => e.createdAt)).size === 3)
check('timestamps strictly increase with position', stamped.every((e, i) => i === 0 || e.createdAt > stamped[i - 1].createdAt))

// After a reopen shuffles them, sorting by createdAt restores the tab order.
const shuffled = [stamped[2], stamped[0], stamped[1]]
const resorted = [...shuffled].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
check('sorting by createdAt restores the arranged order', resorted.map((e) => e.pos).join(',') === '0,1,2')

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
