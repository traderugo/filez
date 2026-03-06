import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET — user checks their pending invites
export async function GET(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: invites } = await supabase
      .from('org_invites')
      .select('id, org_id, status, invited_at, organizations(id, name)')
      .eq('email', user.email)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })

    // Also fetch accepted invite for current station (for page permissions)
    let visiblePages = null
    if (user.org_id) {
      const { data: membership } = await supabase
        .from('org_invites')
        .select('visible_pages')
        .eq('email', user.email)
        .eq('org_id', user.org_id)
        .eq('status', 'accepted')
        .single()
      visiblePages = membership?.visible_pages ?? ['dso', 'lube']
    }

    return NextResponse.json({ invites: invites || [], visiblePages })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — station manager adds an email invite
export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`invite:${user.id}`, 20)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { org_id, email } = await request.json()

    if (!org_id || !email) {
      return NextResponse.json({ error: 'Station and email are required' }, { status: 400 })
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Verify user owns this station
    const { data: station } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', org_id)
      .eq('owner_id', user.id)
      .single()

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    const { data: invite, error } = await supabase
      .from('org_invites')
      .upsert(
        { org_id, email: email.toLowerCase(), status: 'pending', invited_at: new Date().toISOString(), responded_at: null },
        { onConflict: 'org_id,email' }
      )
      .select('id, email, status, invited_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    return NextResponse.json({ invite })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — station manager removes an invite
export async function DELETE(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Invite id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Only delete invites for stations this user owns
    const { data: invite } = await supabase
      .from('org_invites')
      .select('id, org_id')
      .eq('id', id)
      .single()

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const { data: station } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', invite.org_id)
      .eq('owner_id', user.id)
      .single()

    if (!station) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await supabase
      .from('org_invites')
      .delete()
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
