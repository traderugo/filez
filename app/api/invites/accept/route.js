import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

// POST — user accepts an invite, joins the station
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invite_id } = await request.json()
    if (!invite_id) {
      return NextResponse.json({ error: 'Invite id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Fetch the invite — must match user's email and be pending
    const { data: invite } = await supabase
      .from('org_invites')
      .select('id, org_id, email, status')
      .eq('id', invite_id)
      .eq('email', user.email)
      .eq('status', 'pending')
      .single()

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
    }

    // Update user's org_id to latest accepted station (convenience field)
    await supabase
      .from('users')
      .update({ org_id: invite.org_id })
      .eq('id', user.id)

    // Mark invite as accepted
    await supabase
      .from('org_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', invite.id)

    return NextResponse.json({ ok: true, org_id: invite.org_id })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
