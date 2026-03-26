import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

const VALID_PAGES = [
  'daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments',
  'report-summary', 'report-daily-sales', 'report-audit', 'report-account-ledger', 'report-product-received',
  'report-audit-sales-cash', 'report-audit-lodgement-sheet', 'report-audit-stock-position',
  'report-audit-stock-summary', 'report-audit-consumption', 'report-audit-calculator',
  'report-audit-product-received',
  'report-lube',
  'imprest',
]

// PATCH — manager updates visible_pages for a staff invite
export async function PATCH(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invite_id, visible_pages } = await request.json()
    if (!invite_id || !Array.isArray(visible_pages)) {
      return NextResponse.json({ error: 'invite_id and visible_pages array required' }, { status: 400 })
    }

    // Only allow known page keys
    const filtered = visible_pages.filter((p) => VALID_PAGES.includes(p))

    const supabase = getAdminClient()

    // Verify the invite belongs to a station this user owns
    const { data: invite } = await supabase
      .from('org_invites')
      .select('id, org_id')
      .eq('id', invite_id)
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

    const { error } = await supabase
      .from('org_invites')
      .update({ visible_pages: filtered })
      .eq('id', invite_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, visible_pages: filtered })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
