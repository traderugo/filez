import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { logActivity } from '@/lib/entryHelpers'

// POST — user leaves a station (updates invite status, clears org_id if it matches)
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { org_id } = await request.json()
    if (!org_id) {
      return NextResponse.json({ error: 'Station is required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Update invite status to 'left'
    await supabase
      .from('org_invites')
      .update({ status: 'left', responded_at: new Date().toISOString() })
      .eq('org_id', org_id)
      .eq('email', user.email)
      .eq('status', 'accepted')

    // Clear org_id if it matches this station
    if (user.org_id === org_id) {
      await supabase
        .from('users')
        .update({ org_id: null })
        .eq('id', user.id)
    }

    await logActivity(supabase, { orgId: org_id, userId: user.id, userName: user.name || user.email, content: 'left the station', actionType: 'left_station' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
