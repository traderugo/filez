import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient, paginationParams, requireService } from '@/lib/entryHelpers'

const TABLE = 'customer_payment_entries'
const SERVICE_KEY = 'customer-payments'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { from, to, page, limit } = paginationParams(request)
    const supabase = getServiceClient()

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

    const { entry_date, customer_id, amount_paid, sales_amount, notes } = await request.json()

    if (!entry_date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!customer_id) return NextResponse.json({ error: 'Customer is required' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .insert({
        org_id: user.org_id,
        entry_date,
        customer_id,
        amount_paid: Number(amount_paid) || 0,
        sales_amount: Number(sales_amount) || 0,
        notes: notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

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

    const { id, entry_date, customer_id, amount_paid, sales_amount, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (customer_id !== undefined) updates.customer_id = customer_id
    if (amount_paid !== undefined) updates.amount_paid = Number(amount_paid) || 0
    if (sales_amount !== undefined) updates.sales_amount = Number(sales_amount) || 0
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
