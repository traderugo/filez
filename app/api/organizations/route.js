import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
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

async function getAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? profile : null
}

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const admin = await getAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', admin.id)
      .single()

    return NextResponse.json({ org: org || null })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await getAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`org:${admin.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name } = await request.json()
    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    // Check if admin already has an org
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', admin.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'You already have an organization' }, { status: 409 })
    }

    // Generate unique slug
    let slug = slugify(name)
    if (!slug) slug = 'org'
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
      .insert({ name: name.trim(), slug, owner_id: admin.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    return NextResponse.json({ org })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await getAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`org:${admin.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name } = await request.json()
    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .update({ name: name.trim() })
      .eq('owner_id', admin.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    return NextResponse.json({ org })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
