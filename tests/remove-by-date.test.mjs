/**
 * Tests removeByDate, which clears every daily-sales entry for one day so it can be
 * re-entered from scratch.
 *
 * The risky part is not the local delete, it is the sync queue. If a pending CREATE for a
 * deleted entry survives, the sync engine pushes it after the DELETE and the entry comes
 * back — which would look exactly like the delete silently failing.
 *
 * Dexie is stubbed with an in-memory table so this runs without a browser.
 *
 * Run: node tests/remove-by-date.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Pull createRepository out of source so this cannot drift from the real implementation.
const src = readFileSync(resolve(__dirname, '..', 'lib', 'repositories', 'base.js'), 'utf8')
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
const start = src.indexOf('export function createRepository(')
if (start === -1) throw new Error('createRepository not found')
const body = extractFunction(src, src.indexOf('{', start))

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

// Minimal in-memory stand-ins for the Dexie tables the repo touches.
function makeTable(rows = []) {
  const store = new Map(rows.map((r) => [r.id, r]))
  return {
    store,
    async add(r) { store.set(r.id, r) },
    async put(r) { store.set(r.id, r) },
    async get(id) { return store.get(id) },
    async delete(id) { store.delete(id) },
    async bulkDelete(ids) { for (const id of ids) store.delete(id) },
    where(field) {
      return {
        equals(value) {
          const matching = () => [...store.values()].filter((r) => r[field] === value)
          return {
            async toArray() { return matching() },
            filter(fn) { return { async toArray() { return matching().filter(fn) } } },
            async sortBy(key) { return matching().sort((a, b) => String(a[key]).localeCompare(String(b[key]))) },
          }
        },
      }
    },
  }
}

function makeQueue(items = []) {
  let next = 1
  const store = new Map()
  for (const it of items) store.set(next, { ...it, queueId: next++ })
  return {
    store,
    async add(item) { const id = next++; store.set(id, { ...item, queueId: id }); return id },
    async bulkAdd(list) { for (const item of list) { const id = next++; store.set(id, { ...item, queueId: id }) } },
    async delete(queueId) { store.delete(queueId) },
    where() {
      return {
        equals() {
          return { async toArray() { return [...store.values()] } }
        },
      }
    },
    all() { return [...store.values()] },
  }
}

function buildRepo({ rows, queueItems }) {
  const table = makeTable(rows)
  const syncQueue = makeQueue(queueItems)
  const db = { dailySales: table, syncQueue }
  const toServerPayload = (_t, r) => r
  const factory = new Function('db', 'toServerPayload', `return function createRepository(tableName) ${body}`)(db, toServerPayload)
  return { repo: factory('dailySales'), table, syncQueue }
}

const ORG = 'org_1'
const entry = (id, date) => ({ id, orgId: ORG, entryDate: date, nozzleReadings: [] })

// 1) Clears the day and leaves everything else alone.
console.log('\n1. clearing one day')
{
  const { repo, table } = buildRepo({
    rows: [
      entry('a', '2026-07-01'), entry('b', '2026-07-01'), entry('c', '2026-07-01'),
      entry('d', '2026-07-02'),                     // different day
      { id: 'e', orgId: 'other_org', entryDate: '2026-07-01', nozzleReadings: [] }, // different org
    ],
    queueItems: [],
  })
  const removed = await repo.removeByDate(ORG, '2026-07-01')
  check('reports how many it removed', removed === 3, `removed=${removed}`)
  const left = [...table.store.keys()].sort()
  check('only that day for that org is gone', left.join(',') === 'd,e', `left=${left.join(',')}`)
}

// 2) The sync-queue contract: pending writes purged, DELETEs queued.
console.log('\n2. sync queue')
{
  const { repo, syncQueue } = buildRepo({
    rows: [entry('a', '2026-07-01'), entry('b', '2026-07-01'), entry('d', '2026-07-02')],
    queueItems: [
      { table: 'dailySales', operation: 'CREATE', orgId: ORG, payload: { id: 'a' } },
      { table: 'dailySales', operation: 'UPDATE', orgId: ORG, payload: { id: 'b' } },
      { table: 'dailySales', operation: 'CREATE', orgId: ORG, payload: { id: 'd' } }, // other day
    ],
  })
  await repo.removeByDate(ORG, '2026-07-01')
  const items = syncQueue.all()

  const survivingWrites = items.filter((i) => i.operation !== 'DELETE').map((i) => i.payload.id)
  check('pending CREATE/UPDATE for deleted entries are purged, so sync cannot resurrect them',
    survivingWrites.join(',') === 'd', `surviving=${survivingWrites.join(',') || 'none'}`)

  const deletes = items.filter((i) => i.operation === 'DELETE').map((i) => i.payload.id).sort()
  check('a DELETE is queued for each removed entry', deletes.join(',') === 'a,b', `deletes=${deletes.join(',')}`)
  check('the untouched day keeps its pending write',
    items.some((i) => i.payload.id === 'd' && i.operation === 'CREATE'))
}

// 3) Nothing to do is not an error.
console.log('\n3. a day with no entries')
{
  const { repo, syncQueue } = buildRepo({ rows: [entry('a', '2026-07-01')], queueItems: [] })
  const removed = await repo.removeByDate(ORG, '2026-07-09')
  check('returns 0 and queues nothing', removed === 0 && syncQueue.all().length === 0)
}

// 4) Snake_case rows (server shape) are matched too.
console.log('\n4. rows carrying entry_date instead of entryDate')
{
  const { repo, table } = buildRepo({
    rows: [{ id: 'a', orgId: ORG, entry_date: '2026-07-01' }, entry('b', '2026-07-01')],
    queueItems: [],
  })
  const removed = await repo.removeByDate(ORG, '2026-07-01')
  check('both shapes are cleared', removed === 2 && table.store.size === 0, `removed=${removed}`)
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
