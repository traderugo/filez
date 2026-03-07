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

// GET — list all services (public)
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data } = await supabase
      .from('services')
      .select('id, key, name, description, price, is_active')
      .order('name')

    return NextResponse.json({ services: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update price or is_active only (admin only)
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

    const { id, price, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Service id required' }, { status: 400 })
    }

    const updates = {}
    if (price !== undefined) {
      if (isNaN(price) || Number(price) < 0) {
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
