import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

// GET — list groups for the current user
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()
    const { data: groups } = await supabase
      .from('station_groups')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('name')

    return NextResponse.json({ groups: groups || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create a new group
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`groups:${user.id}`, 20)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name } = await request.json()
    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data: group, error } = await supabase
      .from('station_groups')
      .insert({ owner_id: user.id, name: name.trim() })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Group already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
    }

    return NextResponse.json({ group })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove a group (and unset it from any stations using it)
export async function DELETE(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Group id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Get group name before deleting
    const { data: group } = await supabase
      .from('station_groups')
      .select('name')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Unset station_group on any stations using this group name
    await supabase
      .from('organizations')
      .update({ station_group: null })
      .eq('owner_id', user.id)
      .eq('station_group', group.name)

    // Delete the group
    const { error } = await supabase
      .from('station_groups')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — assign a group to a station
export async function PATCH(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { station_id, group_name } = await request.json()
    if (!station_id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { error } = await supabase
      .from('organizations')
      .update({ station_group: group_name || null })
      .eq('id', station_id)
      .eq('owner_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update station group' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
