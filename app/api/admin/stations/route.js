import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { isAdmin } from '@/lib/stationAccess'

/**
 * GET — every station on the platform, for the admin Stations screen.
 *
 * The admin screen used to read /api/organizations, which answers "stations I own or staff".
 * For a platform admin that is their own handful, so the screen that exists to manage
 * everyone's stations showed almost none of them — and there was no way to reach a station
 * you were onboarding except by typing its id into the setup URL.
 *
 * Kept out of /api/organizations deliberately: that route is tenant-scoped, and adding an
 * "everything" mode to it would put one query away from leaking the whole platform to any
 * caller who guessed a parameter. Admin-wide reads live under /api/admin, gated once, here.
 *
 * Read-only, so nothing is written to the audit log.
 */
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = getAdminClient()
    const { data: stations } = await supabase
      .from('organizations')
      .select('id, name, slug, location, station_group, onboarding_complete, owner_id, created_at')
      .order('created_at', { ascending: false })

    // The owner's name/email, so the screen can say whose station it is rather than
    // showing a bare uuid. One round trip, not one per station.
    const ownerIds = [...new Set((stations || []).map((s) => s.owner_id).filter(Boolean))]
    let owners = {}
    if (ownerIds.length) {
      const { data: users } = await supabase
        .from('users').select('id, name, email').in('id', ownerIds)
      owners = Object.fromEntries((users || []).map((u) => [u.id, u]))
    }

    return NextResponse.json({
      stations: (stations || []).map((s) => ({
        ...s,
        owner_name: owners[s.owner_id]?.name || owners[s.owner_id]?.email || '',
        // Rename and delete still go through the owner-gated tenant route, so the screen
        // must know which stations those controls can actually act on.
        is_mine: s.owner_id === user.id,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
