/**
 * Pins who may act inside a station.
 *
 * The rule used to be `.eq('owner_id', user.id)` written out in ten route files, which is
 * why a platform admin could not run the setup wizard for a station they were onboarding:
 * the owner check 404s them. hasStationAccess is the one place that decides, and it reports
 * HOW access was granted so admin-on-behalf writes can be recorded.
 *
 * The Supabase client is stubbed with a tiny fake so the real query chain is exercised
 * (.from().select().eq().eq().maybeSingle()) without a database.
 *
 * Run: node tests/station-access.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the source with its imports stripped; getAdminClient is injected by the test.
const src = readFileSync(resolve(__dirname, '..', 'lib', 'stationAccess.js'), 'utf8')
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/export\s+/g, '')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

/**
 * Fake Supabase. `rows` maps table -> array of records; a chain of .eq() filters them and
 * maybeSingle() returns the first match or null.
 */
function fakeClient(rows) {
  return {
    from(table) {
      let set = (rows[table] || []).slice()
      const chain = {
        select: () => chain,
        eq(col, val) { set = set.filter((r) => r[col] === val); return chain },
        maybeSingle: async () => ({ data: set[0] || null }),
      }
      return chain
    },
  }
}

const load = (rows) =>
  new Function('getAdminClient', `${src}\nreturn { isAdmin, hasStationAccess, requireStation }`)(() => fakeClient(rows))

const STATION = { id: 'org-1', owner_id: 'u-owner' }
const OTHER = { id: 'org-2', owner_id: 'u-someone' }
const base = {
  organizations: [STATION, OTHER],
  org_invites: [{ org_id: 'org-1', email: 'staff@x.com', status: 'accepted' }],
}

const OWNER = { id: 'u-owner', email: 'owner@x.com', role: 'owner' }
const STAFF = { id: 'u-staff', email: 'staff@x.com', role: 'owner' }
const ADMIN = { id: 'u-admin', email: 'admin@x.com', role: 'admin' }
const STRANGER = { id: 'u-nobody', email: 'nobody@x.com', role: 'owner' }

console.log('\nstation access')

const { isAdmin, hasStationAccess, requireStation } = load(base)

check('role admin is recognised', isAdmin(ADMIN) === true && isAdmin(OWNER) === false)

check('owner gets in, reported as owner', (await hasStationAccess(OWNER, 'org-1')).via === 'owner')
check('accepted invite gets in, reported as member', (await hasStationAccess(STAFF, 'org-1')).via === 'member')

// The regression this whole change exists for.
const adminAccess = await hasStationAccess(ADMIN, 'org-1')
check('ADMIN gets into a station they do not own', adminAccess.ok === true && adminAccess.via === 'admin')

check('a stranger is refused', (await hasStationAccess(STRANGER, 'org-1')).ok === false)
check('an accepted invite for ANOTHER station does not grant access',
  (await hasStationAccess(STAFF, 'org-2')).ok === false)

// An admin who owns the station is an owner, so their writes are not logged as assists.
const adminOwner = { id: 'u-owner', email: 'owner@x.com', role: 'admin' }
check('admin who owns the station is reported as owner, not admin',
  (await hasStationAccess(adminOwner, 'org-1')).via === 'owner')

// A typo'd id must not read as authorized just because the caller is staff.
check('admin is refused a station id that does not exist',
  (await hasStationAccess(ADMIN, 'org-nope')).ok === false)

check('no user is refused', (await hasStationAccess(null, 'org-1')).ok === false)
check('no station id is refused', (await hasStationAccess(OWNER, null)).ok === false)

// A pending invite is not access.
const pending = load({
  organizations: [STATION],
  org_invites: [{ org_id: 'org-1', email: 'staff@x.com', status: 'pending' }],
})
check('a PENDING invite does not grant access',
  (await pending.hasStationAccess(STAFF, 'org-1')).ok === false)

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
