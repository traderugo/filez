import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'

// POST — user leaves a station (updates invite status, clears org_id if it matches)
export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { org_id } = await request.json()
    if (!org_id) {
      return NextResponse.json({ error: 'Station is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

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

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
