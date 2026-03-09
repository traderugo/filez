import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET — list stations the user manages
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()
    const { data: stations } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at')

    // Fetch stations the user is a member of (via accepted invites, not owner)
    const { data: invites } = await supabase
      .from('org_invites')
      .select('org_id, organizations(id, name, slug, location, onboarding_complete)')
      .eq('email', user.email)
      .eq('status', 'accepted')

    const ownedIds = new Set((stations || []).map(s => s.id))
    const memberStations = (invites || [])
      .map(i => i.organizations)
      .filter(Boolean)
      .filter(org => !ownedIds.has(org.id))

    return NextResponse.json({ stations: stations || [], memberStations })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create a new station
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`org:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name } = await request.json()
    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Generate unique slug
    let slug = slugify(name)
    if (!slug) slug = 'station'
    const { data: slugCheck } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (slugCheck) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), slug, owner_id: user.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create station' }, { status: 500 })
    }

    // Set org_id on the owner's user record
    await supabase
      .from('users')
      .update({ org_id: org.id })
      .eq('id', user.id)

    return NextResponse.json({ org })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update a station
export async function PATCH(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`org:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id, name } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: org, error } = await supabase
      .from('organizations')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update station' }, { status: 500 })
    }

    return NextResponse.json({ org })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — delete a station
export async function DELETE(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete station' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
