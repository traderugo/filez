import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

// GET — user checks their pending invites
export async function GET(request) {
  try {
    const user = await getAuthUser()
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

    // Also fetch accepted invite for a specific station (for page permissions)
    const { searchParams } = new URL(request.url)
    const org_id = searchParams.get('org_id') || user.org_id
    let visiblePages = null
    if (org_id) {
      const { data: membership } = await supabase
        .from('org_invites')
        .select('visible_pages')
        .eq('email', user.email)
        .eq('org_id', org_id)
        .eq('status', 'accepted')
        .single()
      visiblePages = membership?.visible_pages ?? [
        'daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments',
        'report-summary', 'report-daily-sales', 'report-audit',
        'report-audit-sales-cash', 'report-audit-lodgement-sheet', 'report-audit-stock-position',
        'report-audit-stock-summary', 'report-audit-consumption', 'report-audit-calculator',
        'report-audit-product-received',
        'report-account-ledger', 'report-product-received', 'report-lube',
      ]
    }

    return NextResponse.json({ invites: invites || [], visiblePages })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — station manager invites a user by email (creates pending invite)
export async function POST(request) {
  try {
    const user = await getAuthUser()
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

    const normalizedEmail = email.toLowerCase()

    // Create pending invite — user will see it on their dashboard after signup/login
    const { data: invite, error } = await supabase
      .from('org_invites')
      .upsert(
        { org_id, email: normalizedEmail, status: 'pending', invited_at: new Date().toISOString(), responded_at: null },
        { onConflict: 'org_id,email' }
      )
      .select('id, email, status, invited_at, visible_pages')
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
    const user = await getAuthUser()
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
