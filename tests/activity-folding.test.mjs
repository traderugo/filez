/**
 * One form save is one notification.
 *
 * The entry forms write each row through a repo into Dexie and queue one sync op per row.
 * lib/sync.js pushes those ops ONE AT A TIME, each hitting /api/entries/<type> separately, and
 * every one of those routes ends with its own logActivity call. So editing a day with five
 * lodgement rows produced five identical "updated a lodgement entry" rows in the inbox, and
 * inflated the bell's unread count by the same factor.
 *
 * The fix folds them at the point of writing: an activity of the same kind, by the same person,
 * in the same station, inside a two-minute window, updates the row already there instead of
 * adding another — and carries the count, so five rows read as "updated 5 lodgement entries".
 *
 * Two minutes rather than seconds because the queue drains in a burst after a spell offline,
 * and a window that expires mid-drain would split the save again, which is the bug itself.
 *
 * The Supabase client is stubbed so the real query chain is exercised without a database.
 *
 * Run: node tests/activity-folding.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the source with its imports stripped; nothing else in the file is exercised here.
const src = readFileSync(resolve(__dirname, '..', 'lib', 'entryHelpers.js'), 'utf8')
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/export\s+/g, '')

const NextResponse = { json: (b, i) => ({ body: b, ...i }) } // referenced by other helpers
const mod = new Function('NextResponse', `${src}; return { activityPhrase, parseActivityCount, logActivity, ACTIVITY_FOLD_MS }`)(NextResponse)
const { activityPhrase, parseActivityCount, logActivity, ACTIVITY_FOLD_MS } = mod

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

/* ── The phrase ─────────────────────────────────────────────────────────── */

console.log('\nHow a folded activity reads')

check('one row keeps the article',
  activityPhrase('added', 'lodgement entry', 1) === 'added a lodgement entry',
  activityPhrase('added', 'lodgement entry', 1))

check('a vowel takes "an", so it is not "a imprest entry"',
  activityPhrase('added', 'imprest entry', 1) === 'added an imprest entry',
  activityPhrase('added', 'imprest entry', 1))

check('several rows carry the count and pluralise',
  activityPhrase('updated', 'lodgement entry', 5) === 'updated 5 lodgement entries',
  activityPhrase('updated', 'lodgement entry', 5))

check('a multi-word noun pluralises on its last word only',
  activityPhrase('added', 'customer payment entry', 3) === 'added 3 customer payment entries',
  activityPhrase('added', 'customer payment entry', 3))

/* ── Reading the count back ─────────────────────────────────────────────── */

console.log('\nRecognising a row it may fold into')

check('reads 1 out of the singular form',
  parseActivityCount('added a lodgement entry', 'added', 'lodgement entry') === 1)

check('reads the number out of the plural form',
  parseActivityCount('updated 5 lodgement entries', 'updated', 'lodgement entry') === 5)

check('refuses a different verb — an add must not fold into an edit',
  parseActivityCount('added a lodgement entry', 'updated', 'lodgement entry') === null)

check('refuses a different entry type',
  parseActivityCount('added a lodgement entry', 'added', 'lube sales entry') === null)

check('refuses a noun that merely ends the same way',
  parseActivityCount('added a lube sales entry', 'added', 'sales entry') === null)

check('refuses free text written by the other callers',
  parseActivityCount('created imprest period', 'added', 'lodgement entry') === null)

/* ── The fold itself ────────────────────────────────────────────────────── */

console.log('\nFive rows of one form save')

/**
 * The narrowest fake that still exercises the real chain: .from().insert(), and
 * .from().select().eq().eq().eq().gte().order().limit(), plus .update().eq().
 */
// `now` defaults to the real clock: the window is measured against Date.now() inside
// logActivity, so a fixed timestamp would sit outside it and nothing would ever fold.
function fakeSupabase(rows = [], now = Date.now()) {
  const table = rows
  const api = {
    from() { return api },
    insert(row) {
      table.push({ id: `m${table.length + 1}`, created_at: new Date(now).toISOString(), ...row })
      return Promise.resolve({ error: null })
    },
    update(patch) {
      api._patch = patch
      return {
        eq(_col, id) {
          const r = table.find((t) => t.id === id)
          if (r) Object.assign(r, api._patch)
          return Promise.resolve({ error: null })
        },
      }
    },
    select() { api._f = {}; return api },
    eq(col, val) { api._f[col] = val; return api },
    gte(_col, iso) { api._since = iso; return api },
    order() { return api },
    limit() {
      const found = table
        .filter((r) => r.type === 'activity')
        .filter((r) => Object.entries(api._f).every(([k, v]) => r[k] === v))
        .filter((r) => !api._since || r.created_at >= api._since)
        .slice(-1)
      return Promise.resolve({ data: found, error: null })
    },
  }
  return { api, table }
}

const who = { orgId: 'org-1', userId: 'u1', userName: 'Ada' }

{
  const { api, table } = fakeSupabase()
  for (let i = 0; i < 5; i++) {
    await logActivity(api, { ...who, verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
  }
  check('collapses to a single notification', table.length === 1, `got ${table.length}`)
  check('and says how many rows changed',
    table[0]?.content === 'updated 5 lodgement entries', table[0]?.content)
}

{
  // Two different entry types in one sitting are two different things and stay apart.
  const { api, table } = fakeSupabase()
  await logActivity(api, { ...who, verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
  await logActivity(api, { ...who, verb: 'updated', noun: 'lube sales entry', actionType: 'updated_entry' })
  check('does not fold two different entry types together', table.length === 2, `got ${table.length}`)
}

{
  // Adding and editing in one sitting are different events.
  const { api, table } = fakeSupabase()
  await logActivity(api, { ...who, verb: 'added', noun: 'lodgement entry', actionType: 'created_entry' })
  await logActivity(api, { ...who, verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
  check('does not fold an add into an edit', table.length === 2, `got ${table.length}`)
}

{
  // Two people working the same station at once must each be seen.
  const { api, table } = fakeSupabase()
  await logActivity(api, { ...who, verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
  await logActivity(api, { ...who, userId: 'u2', userName: 'Bo', verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
  check('does not fold two different people together', table.length === 2, `got ${table.length}`)
}

{
  // Outside the window it is a separate visit to the form, and real history.
  const old = Date.parse('2026-08-13T09:00:00Z')
  const { api, table } = fakeSupabase([{
    id: 'm1', org_id: 'org-1', user_id: 'u1', type: 'activity', action_type: 'updated_entry',
    content: 'updated a lodgement entry', created_at: new Date(old).toISOString(),
  }])
  await logActivity(api, { ...who, verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
  check('does not fold into an activity older than the window', table.length === 2, `got ${table.length}`)
}

check('the window is two minutes', ACTIVITY_FOLD_MS === 2 * 60 * 1000, String(ACTIVITY_FOLD_MS))

/* ── The other callers still work ───────────────────────────────────────── */

console.log('\nThe one-off events that pass a finished sentence')

{
  const { api, table } = fakeSupabase()
  await logActivity(api, { ...who, content: 'created imprest period', actionType: 'imprest_period' })
  await logActivity(api, { ...who, content: 'created imprest period', actionType: 'imprest_period' })
  check('a caller passing `content` is written through unchanged',
    table[0]?.content === 'created imprest period', table[0]?.content)
  // Nothing folds these: they are single events, so two of them really are two.
  check('and is never folded', table.length === 2, `got ${table.length}`)
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
