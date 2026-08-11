import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess, canAdministerStation } from '@/lib/stationAccess'
import { logStationAssist } from '@/lib/adminActivity'
import { randomBytes } from 'crypto'
import { rateLimit } from '@/lib/rateLimit'

// POST — manager resets a staff member's password
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`reset:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { staff_email } = await request.json()
    if (!staff_email) {
      return NextResponse.json({ error: 'Staff email required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Find staff user
    const { data: staff } = await supabase
      .from('users')
      .select('id, email, org_id')
      .eq('email', staff_email.toLowerCase())
      .single()

    if (!staff || !staff.org_id) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // Verify the manager owns the station this staff belongs to
    // Owner or platform admin. Emphatically not ordinary staff: this sets another person's
    // password, so a member reaching it could take over a colleague's account.
    const { ok, via } = await hasStationAccess(user, staff.org_id)
    if (!ok || !canAdministerStation(via)) {
      return NextResponse.json({ error: 'You can only reset passwords for your own staff' }, { status: 403 })
    }

    const tempPassword = randomBytes(6).toString('base64url').slice(0, 10)

    // Set the password in Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(staff.id, {
      password: tempPassword,
    })

    if (error) {
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }

    // The temp password is deliberately NOT put in the log: details is read back verbatim.
    await logStationAssist({
      user, via, orgId: staff.org_id, request,
      actionType: 'staff_password_reset',
      content: 'reset a staff password at a station on their behalf',
    })

    return NextResponse.json({ ok: true, tempPassword })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
