import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

/**
 * Who may act inside a station, in one place.
 *
 * Until now this rule was written inline in every route — 18 copies of
 * `.eq('owner_id', user.id)` across ten files — with the member path (an accepted
 * org_invite) bolted on separately in some of them and missing from the rest. That is why
 * a platform admin could not run the setup wizard for a station they were onboarding: the
 * owner check 404s them, and there was no shared notion of "may act here" to extend.
 *
 * Three ways in, and the caller is told WHICH, because they are not equivalent:
 *   owner   the station is theirs
 *   member  they hold an accepted invite
 *   admin   platform staff acting on someone else's station
 *
 * `admin` is deliberately the widest and the loudest. It grants access to EVERY station,
 * so callers are expected to record what was done with it (see lib/adminActivity.js) —
 * the audit trail, not the permission check, is what makes it safe.
 */

/** Platform staff. Role lives on the users row and is what middleware gates /admin on. */
export function isAdmin(user) {
  return user?.role === 'admin'
}

/**
 * Can this user act inside this station? Returns { ok, via }.
 *
 * Ownership is checked before membership, and membership before admin, so `via` always
 * names the most direct relationship — an admin who happens to own the station is reported
 * as its owner, and their writes are not logged as assists.
 */
export async function hasStationAccess(user, orgId) {
  if (!user || !orgId) return { ok: false, via: null }

  const supabase = getAdminClient()

  const { data: owned } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (owned) return { ok: true, via: 'owner' }

  // Invites are keyed by email, not user id: one is sent before the person has an account.
  if (user.email) {
    const { data: invite } = await supabase
      .from('org_invites')
      .select('org_id')
      .eq('org_id', orgId)
      .eq('email', user.email)
      .eq('status', 'accepted')
      .maybeSingle()
    if (invite) return { ok: true, via: 'member' }
  }

  // Admin last, and only against a station that exists — otherwise a typo'd id would read
  // as authorized and the caller would go on to write against nothing.
  if (isAdmin(user)) {
    const { data: station } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle()
    if (station) return { ok: true, via: 'admin' }
  }

  return { ok: false, via: null }
}

/**
 * Owner or platform admin, but NOT ordinary staff.
 *
 * Some station actions are administrative rather than operational: inviting staff, changing
 * their permissions, starting a subscription, resetting a staff password. `hasStationAccess`
 * admits accepted members too, so calling it alone on those routes would let any staff
 * member invite more staff — a privilege escalation, and not what widening access to
 * platform admins was meant to do.
 *
 * Pass the `via` from hasStationAccess. Kept as a named function rather than an inline
 * `via !== 'member'` so the intent is greppable and the rule has one definition.
 */
export function canAdministerStation(via) {
  return via === 'owner' || via === 'admin'
}

/**
 * Resolve and authorize the station a request is about.
 *
 * Reads ?org_id= (the convention in this app), falling back to an explicit `orgId` for
 * routes that take it from the path or the body instead. Returns { user, orgId, via } or
 * { error: { status, message } }.
 *
 * A station that exists but is not the caller's returns 404, not 403: telling a stranger
 * "that station exists, you just can't see it" leaks the id space.
 */
export async function requireStation(request, { orgId: explicitId } = {}) {
  const user = await getAuthUser()
  if (!user) return { error: { status: 401, message: 'Unauthorized' } }

  let orgId = explicitId
  if (!orgId && request?.url) {
    orgId = new URL(request.url).searchParams.get('org_id')
  }
  if (!orgId) return { error: { status: 400, message: 'Station id required' } }

  const { ok, via } = await hasStationAccess(user, orgId)
  if (!ok) return { error: { status: 404, message: 'Station not found' } }

  return { user, orgId, via }
}
