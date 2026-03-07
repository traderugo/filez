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

// GET — list all active services (any authenticated user)
export async function GET(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()
    const { data } = await supabase
      .from('services')
      .select('id, name, description, price, is_active')
      .order('name')

    // Non-admins only see active services
    const services = user.role === 'admin'
      ? (data || [])
      : (data || []).filter((s) => s.is_active)

    return NextResponse.json({ services })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create a service (admin only)
export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`svc:${user.id}`, 20)
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

    const supabase = getAdminClient()
    const { data, error } = await supabase
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
    const user = await getPinUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`svc:${user.id}`, 20)
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

    const supabase = getAdminClient()
    const { data, error } = await supabase
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
    const user = await getPinUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Service id required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { error } = await supabase
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
