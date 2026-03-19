import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'consumption_entries'
const SERVICE_KEY = 'fuel-operations'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { from, to, page, limit, searchParams } = paginationParams(request)
    const supabase = getServiceClient()

    // Single entry by ID
    const id = searchParams.get('id')
    if (id) {
      const { data } = await supabase.from(TABLE).select('*, users:created_by(name), customer:customer_id(id, name, phone)').eq('id', id).eq('org_id', user.org_id).single()
      return NextResponse.json({ entry: data })
    }

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name), customer:customer_id(id, name, phone)', { count: 'exact' })
      .eq('org_id', user.org_id)
      .order('entry_date', { ascending: false })
      .range(from, to)

    return NextResponse.json({ entries: data || [], total: count || 0, page, limit })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes } = await request.json()

    if (!entry_date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!customer_id) return NextResponse.json({ error: 'Customer/account is required' }, { status: 400 })
    if (!fuel_type) return NextResponse.json({ error: 'Fuel type is required' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(id ? { id } : {}),
        org_id: user.org_id,
        entry_date,
        customer_id,
        quantity: Number(quantity) || 0,
        fuel_type,
        is_pour_back: !!is_pour_back,
        price: Number(price) || 0,
        notes: notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, content: 'added a consumption entry', actionType: 'created_entry' }).catch(() => {})
    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id, entry_date, customer_id, quantity, fuel_type, is_pour_back, price, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (customer_id !== undefined) updates.customer_id = customer_id
    if (quantity !== undefined) updates.quantity = Number(quantity) || 0
    if (fuel_type !== undefined) updates.fuel_type = fuel_type
    if (is_pour_back !== undefined) updates.is_pour_back = !!is_pour_back
    if (price !== undefined) updates.price = Number(price) || 0
    if (notes !== undefined) updates.notes = notes?.trim() || null

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .eq('org_id', user.org_id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, content: 'updated a consumption entry', actionType: 'updated_entry' }).catch(() => {})
    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const supabase = getServiceClient()
    await supabase.from(TABLE).delete().eq('id', id).eq('org_id', user.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
