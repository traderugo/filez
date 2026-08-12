import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

/**
 * Station groups, for the admin Stations screen.
 *
 * Groups are PLATFORM-WIDE, not per-admin. That screen exists to organise every station on the
 * platform, so none of the station writes here filter by owner_id. They used to, against the
 * admin's own id, which meant every assignment matched zero rows: admins do not own the
 * stations they are grouping. An update matching nothing is not an error, so the route reported
 * success and the change vanished on reload.
 *
 * Stations reference a group by id (organizations.station_group_id, migration 054), not by the
 * old station_group text. Deleting a group is cleaned up by ON DELETE SET NULL rather than by a
 * follow-up statement here.
 *
 * Every mutation reads back what it touched and 404s when nothing matched, so a write that
 * changes no rows can never look like a success again.
 */
async function requireAdmin() {
  const user = await getAuthUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, supabase }
}

// GET — every group on the platform
export async function GET() {
  try {
    const { error: denied, supabase } = await requireAdmin()
    if (denied) return denied

    // The error is read, not discarded. It used to be dropped, so a missing table or a failed
    // query rendered as "no groups yet" and looked like data rather than a fault.
    const { data: groups, error } = await supabase
      .from('station_groups')
      .select('id, name, created_at')
      .order('name')

    if (error) {
      return NextResponse.json({ error: 'Failed to load groups' }, { status: 500 })
    }

    return NextResponse.json({ groups: groups || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create a group
export async function POST(request) {
  try {
    const { error: denied, user, supabase } = await requireAdmin()
    if (denied) return denied

    const { success } = rateLimit(`groups:${user.id}`, 20)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name } = await request.json()
    const trimmed = (name || '').trim()
    if (!trimmed || trimmed.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    // owner_id records who created it. Names are unique platform-wide now, so the 23505 below
    // means the name is taken by anyone, not just by this admin.
    const { data: group, error } = await supabase
      .from('station_groups')
      .insert({ owner_id: user.id, name: trimmed })
      .select('id, name, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
    }

    return NextResponse.json({ group })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove a group. Stations pointing at it are unset by ON DELETE SET NULL.
export async function DELETE(request) {
  try {
    const { error: denied, supabase } = await requireAdmin()
    if (denied) return denied

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Group id required' }, { status: 400 })
    }

    const { data: deleted, error } = await supabase
      .from('station_groups')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
    }
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — put a station in a group, or take it out of one
export async function PATCH(request) {
  try {
    const { error: denied, supabase } = await requireAdmin()
    if (denied) return denied

    const { station_id, group_id } = await request.json()
    if (!station_id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    // Checked before the write so a bad id is a 400 rather than a foreign-key 500.
    if (group_id) {
      const { data: group } = await supabase
        .from('station_groups')
        .select('id')
        .eq('id', group_id)
        .maybeSingle()
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 })
      }
    }

    const { data: updated, error } = await supabase
      .from('organizations')
      .update({ station_group_id: group_id || null })
      .eq('id', station_id)
      .select('id')

    if (error) {
      return NextResponse.json({ error: 'Failed to update station group' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
