import { getAdminClient } from '@/lib/supabaseServer'

/**
 * Audit writer for platform staff acting inside a station they do not own.
 *
 * Fire-and-forget by design. An audit write must never be able to fail the action it
 * describes: an onboarding that saved but was not logged is a gap in the record, whereas an
 * onboarding that FAILED because the record could not be written is a broken product. So
 * every error is swallowed — but logged to the server console, because an audit trail that
 * quietly stops recording looks exactly like an audit trail with nothing to record.
 *
 * Never put a secret in `details` — no passwords, tokens, PINs or account numbers. It is
 * read back verbatim.
 */
export async function logAdminActivity(admin, content, { orgId = null, orgName = '', actionType = '', targetType = '', targetId = null, details } = {}) {
  try {
    if (!content) return
    await getAdminClient().from('admin_activity_logs').insert({
      admin_id: admin?.id || null,
      admin_name: admin?.name || admin?.email || '',
      org_id: orgId,
      org_name: orgName,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      content,
      details: details ?? null,
    })
  } catch (err) {
    console.error('logAdminActivity failed:', err)
  }
}

/**
 * Record an admin acting on someone else's station, if that is what happened.
 *
 * Call this after a successful WRITE with the `via` that requireStation returned. It is a
 * no-op for `owner` and `member`, so routes can call it unconditionally rather than each
 * one re-deciding what counts as an assist — the decision lives here, once.
 *
 * Reads are not passed here at all: logging GETs would bury real actions under page views.
 */
export async function logStationAssist({ user, via, orgId, request, content, actionType = 'station_assist', details }) {
  if (via !== 'admin') return

  let orgName = ''
  try {
    const { data } = await getAdminClient()
      .from('organizations').select('name').eq('id', orgId).maybeSingle()
    orgName = data?.name || ''
  } catch { /* name is a convenience; never block the log for it */ }

  const method = request?.method || ''
  const path = request?.url ? new URL(request.url).pathname : ''

  await logAdminActivity(user, content || `acted inside ${orgName || 'a station'} on their behalf`, {
    orgId,
    orgName,
    actionType,
    targetType: 'organization',
    targetId: orgId,
    details: details ?? (method || path ? { method, path } : null),
  })
}
