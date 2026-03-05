import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

async function getAdminOrg(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', profile.id)
    .single()

  return org ? { adminId: profile.id, orgId: org.id } : null
}

export async function GET(request) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    if (!orgId) {
      return NextResponse.json({ error: 'org_id required' }, { status: 400 })
    }

    const { data: services } = await supabase
      .from('org_services')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order')

    return NextResponse.json({ services: services || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const ctx = await getAdminOrg(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success } = rateLimit(`services:${ctx.adminId}`, 30)
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { name, description, price } = await request.json()

    if (!name || name.trim().length < 1 || name.length > 200) {
      return NextResponse.json({ error: 'Service name required (max 200 chars)' }, { status: 400 })
    }

    if (price !== undefined && (isNaN(price) || price < 0)) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    const { data: last } = await supabase
      .from('org_services')
      .select('sort_order')
      .eq('org_id', ctx.orgId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const { data: service, error } = await supabase
      .from('org_services')
      .insert({
        org_id: ctx.orgId,
        name: name.trim(),
        description: description?.trim() || null,
        price: price ?? 0,
        sort_order: (last?.sort_order ?? -1) + 1,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
    return NextResponse.json({ service })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createServerSupabase()
    const ctx = await getAdminOrg(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, name, description, price, sort_order } = await request.json()
    if (!id) return NextResponse.json({ error: 'Service id required' }, { status: 400 })

    const updates = {}
    if (name !== undefined) {
      if (name.trim().length < 1 || name.length > 200) {
        return NextResponse.json({ error: 'Service name required (max 200 chars)' }, { status: 400 })
      }
      updates.name = name.trim()
    }
    if (description !== undefined) updates.description = description?.trim() || null
    if (price !== undefined) updates.price = price
    if (sort_order !== undefined) updates.sort_order = sort_order

    const { data: service, error } = await supabase
      .from('org_services')
      .update(updates)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
    return NextResponse.json({ service })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const supabase = await createServerSupabase()
    const ctx = await getAdminOrg(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Service id required' }, { status: 400 })

    const { error } = await supabase
      .from('org_services')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (error) return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
