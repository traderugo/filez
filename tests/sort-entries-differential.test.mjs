/**
 * Regression guard for sortEntries.
 *
 * sortEntries decides the order of same-day entries, and entries CHAIN (each entry opening
 * is the previous entry closing), so the order drives every dispensed and sales figure. It
 * is used by 7 report builders, which is why any change to it has to be shown to be inert
 * on well-formed data.
 *
 * LEGACY below is a frozen copy of the implementation this replaced. It returned on the
 * first shared pump it met while walking the other entry's readings array, so the verdict
 * depended on that array's order: comparing (a,b) and (b,a) could disagree, and a single
 * mis-keyed meter shuffled whole days at random. Deleting an entry changed the array, which
 * is how it surfaced.
 *
 * This asserts two things at once:
 *   1. the CURRENT implementation matches LEGACY on well-formed data, so the fix changed
 *      nothing for any correct day;
 *   2. the CURRENT implementation is deterministic where LEGACY was not.
 *
 * Run: node tests/sort-entries-differential.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The CURRENT implementation, lifted from source so this cannot drift from it.
const src = readFileSync(resolve(__dirname, '..', 'lib', 'salesCalculations.js'), 'utf8')
function extractFunction(code, startIdx) {
  let depth = 0
  let started = false
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') { depth++; started = true }
    if (code[i] === '}') depth--
    if (started && depth === 0) return code.slice(startIdx, i + 1)
  }
  throw new Error('could not extract function')
}
const start = src.indexOf('function sortEntries(')
if (start === -1) throw new Error('sortEntries not found in source')
const sortEntriesCurrent = new Function('return ' + extractFunction(src, start))()

// FROZEN copy of the buggy version. Do not "fix" this: it exists to prove the replacement
// behaves identically on correct data.
function sortEntriesLegacy(entries) {
  return [...entries].sort((a, b) => {
    const dateCmp = (a.entryDate || '').localeCompare(b.entryDate || '')
    if (dateCmp !== 0) return dateCmp
    const aMap = {}
    for (const r of (a.nozzleReadings || [])) aMap[r.pump_id] = Number(r.closing_meter || 0)
    for (const r of (b.nozzleReadings || [])) {
      const bVal = Number(r.closing_meter || 0)
      const aVal = aMap[r.pump_id]
      if (aVal != null && aVal !== bVal) return aVal - bVal
    }
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })
}

const ids = (rows) => rows.map((r) => r.id).join(',')
let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

let seed = 20260721
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const randInt = (n) => Math.floor(rand() * n)
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

/**
 * One well-formed day: `shifts` entries over `pumpCount` pumps, meters strictly rising,
 * each entry optionally missing a pump (not read that shift). Returned in true order.
 */
function makeDay(dayNo, shifts, pumpCount, dropChance) {
  const dd = String(dayNo).padStart(2, '0')
  const meters = {}
  for (let p = 1; p <= pumpCount; p++) meters[`p${p}`] = 1000 + randInt(90000)

  const out = []
  for (let s = 1; s <= shifts; s++) {
    const readings = []
    for (let p = 1; p <= pumpCount; p++) {
      const id = `p${p}`
      meters[id] += 1 + randInt(500) // meters only ever go up
      if (rand() < dropChance) continue // pump not read this shift
      readings.push({ pump_id: id, closing_meter: meters[id] })
    }
    if (!readings.length) readings.push({ pump_id: 'p1', closing_meter: meters.p1 })
    out.push({
      id: `d${dd}s${s}`,
      entryDate: `2026-07-${dd}`,
      createdAt: `2026-07-${dd}T${String(s).padStart(2, '0')}:00:00Z`,
      // Shuffled: array order must carry no meaning, which is the real case once an entry
      // has been deleted and re-added.
      nozzleReadings: shuffle(readings),
    })
  }
  return out
}

// 1) Well-formed data: the fix must be invisible here.
console.log('\n1. well-formed days (meters rising, pumps sometimes unread)')
let disagreements = 0
let legacyUnstable = 0
let currentUnstable = 0
let currentWrong = 0
const DAYS = 4000

for (let trial = 0; trial < DAYS; trial++) {
  const shifts = 2 + randInt(3)            // 2 to 4 entries in the day
  const pumps = 2 + randInt(7)             // 2 to 8 pumps
  const drop = [0, 0.1, 0.25][randInt(3)]  // how often a pump goes unread
  const day = makeDay(1 + randInt(28), shifts, pumps, drop)
  const truth = ids(day)

  const legacySeen = new Set()
  const currentSeen = new Set()
  for (let k = 0; k < 6; k++) {
    const input = shuffle(day)
    const l = ids(sortEntriesLegacy(input))
    const c = ids(sortEntriesCurrent(input))
    legacySeen.add(l)
    currentSeen.add(c)
    if (l !== c) disagreements++
  }
  if (legacySeen.size > 1) legacyUnstable++
  if (currentSeen.size > 1) currentUnstable++
  if (currentSeen.size === 1 && [...currentSeen][0] !== truth) currentWrong++
}

console.log(`   ${DAYS} days, 6 shuffles each`)
check('current matches legacy on every well-formed day', disagreements === 0, `disagreements=${disagreements}`)
check('current is stable under shuffling', currentUnstable === 0)
check('current always recovers the true shift order', currentWrong === 0, `wrong=${currentWrong}`)

// 2) One dipped meter: the shape that made the old rule wobble.
console.log('\n2. days containing one dipped meter (a mis-keyed or re-entered reading)')
let dirtyDays = 0
let dirtyLegacyUnstable = 0
let dirtyCurrentUnstable = 0
for (let trial = 0; trial < DAYS; trial++) {
  const day = makeDay(1 + randInt(28), 2 + randInt(3), 2 + randInt(7), 0.1)
  const victim = day[1 + randInt(day.length - 1)]
  if (!victim.nozzleReadings.length) continue
  const r = victim.nozzleReadings[randInt(victim.nozzleReadings.length)]
  r.closing_meter = Math.max(0, r.closing_meter - (1 + randInt(5000)))
  dirtyDays++

  const legacySeen = new Set()
  const currentSeen = new Set()
  for (let k = 0; k < 6; k++) {
    const input = shuffle(day)
    legacySeen.add(ids(sortEntriesLegacy(input)))
    currentSeen.add(ids(sortEntriesCurrent(input)))
  }
  if (legacySeen.size > 1) dirtyLegacyUnstable++
  if (currentSeen.size > 1) dirtyCurrentUnstable++
}
const pct = (n) => `${((n / dirtyDays) * 100).toFixed(1)}%`
console.log(`   ${dirtyDays} days, each with exactly one dipped meter`)
console.log(`   legacy  was unstable on ${dirtyLegacyUnstable} (${pct(dirtyLegacyUnstable)})`)
console.log(`   current is unstable on ${dirtyCurrentUnstable} (${pct(dirtyCurrentUnstable)})`)
check('current stays deterministic even with a bad reading', dirtyCurrentUnstable === 0)
check('this test still exercises the bug it guards against', dirtyLegacyUnstable > 0)

// 3) The reported case: the same two entries compared both ways round.
console.log('\n3. same two entries, compared in both directions')
const A = {
  id: 'A',
  entryDate: '2026-07-01',
  createdAt: '2026-07-01T06:00:00Z',
  nozzleReadings: [{ pump_id: 'p1', closing_meter: 100 }, { pump_id: 'p2', closing_meter: 900 }],
}
const B = {
  id: 'B',
  entryDate: '2026-07-01',
  createdAt: '2026-07-01T14:00:00Z',
  nozzleReadings: [{ pump_id: 'p2', closing_meter: 800 }, { pump_id: 'p1', closing_meter: 200 }],
}
console.log(`   legacy:  [A,B] gives ${ids(sortEntriesLegacy([A, B]))}   [B,A] gives ${ids(sortEntriesLegacy([B, A]))}`)
console.log(`   current: [A,B] gives ${ids(sortEntriesCurrent([A, B]))}   [B,A] gives ${ids(sortEntriesCurrent([B, A]))}`)
check('current agrees with itself in both directions',
  ids(sortEntriesCurrent([A, B])) === ids(sortEntriesCurrent([B, A])))
check('current takes the majority verdict (p1 rising beats one bad p2)',
  ids(sortEntriesCurrent([A, B])) === 'A,B')

// 4) Degenerate inputs must still produce a fixed order rather than input order.
console.log('\n4. entries with nothing to compare on')
const bare = (id, createdAt) => ({ id, entryDate: '2026-07-01', createdAt, nozzleReadings: [] })
const X = bare('X', '2026-07-01T09:00:00Z')
const Y = bare('Y', '2026-07-01T09:00:00Z') // identical timestamps, no readings
check('identical entries still sort deterministically',
  ids(sortEntriesCurrent([X, Y])) === ids(sortEntriesCurrent([Y, X])))
check('no shared pumps falls back to createdAt',
  ids(sortEntriesCurrent([bare('L', '2026-07-01T10:00:00Z'), bare('E', '2026-07-01T08:00:00Z')])) === 'E,L')

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
