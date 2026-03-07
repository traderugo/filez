import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? profile : null
}

// GET — list all active services (public, no auth needed for subscribe page)
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data } = await supabase
      .from('services')
      .select('id, name, description, price, is_active')
      .order('name')

    return NextResponse.json({ services: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create a service (admin only)
export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`svc:${admin.id}`, 20)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name, description, price } = await request.json()

    if (!name || name.trim().length < 1 || name.length > 200) {
      return NextResponse.json({ error: 'Name is required (max 200 chars)' }, { status: 400 })
    }

    if (price == null || Number(price) < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await adminClient
      .from('services')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        price: Number(price),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
    }

    return NextResponse.json({ service: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update a service (admin only)
export async function PATCH(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`svc:${admin.id}`, 20)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id, name, description, price, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Service id required' }, { status: 400 })
    }

    const updates = {}
    if (name !== undefined) {
      if (!name || name.trim().length < 1 || name.length > 200) {
        return NextResponse.json({ error: 'Name is required (max 200 chars)' }, { status: 400 })
      }
      updates.name = name.trim()
    }
    if (description !== undefined) updates.description = description?.trim() || null
    if (price !== undefined) {
      if (Number(price) < 0) {
        return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
      }
      updates.price = Number(price)
    }
    if (is_active !== undefined) updates.is_active = !!is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await adminClient
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
    }

    return NextResponse.json({ service: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — delete a service (admin only)
export async function DELETE(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Service id required' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await adminClient
      .from('services')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
