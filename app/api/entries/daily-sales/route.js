import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient, paginationParams } from '@/lib/entryHelpers'

const TABLE = 'daily_sales_entries'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { from, to, page, limit } = paginationParams(request)
    const supabase = getServiceClient()

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name)', { count: 'exact' })
      .eq('org_id', user.org_id)
      .order('entry_date', { ascending: false })
      .range(from, to)

    return NextResponse.json({
      entries: data || [],
      total: count || 0,
      page,
      limit,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { entry_date, nozzle_readings, ugt_closing_stock, price, notes } = await request.json()

    if (!entry_date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    if (!Array.isArray(nozzle_readings) || nozzle_readings.length === 0) {
      return NextResponse.json({ error: 'Nozzle readings are required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data, error: dbError } = await supabase
      .from(TABLE)
      .insert({
        org_id: user.org_id,
        entry_date,
        nozzle_readings,
        ugt_closing_stock: Number(ugt_closing_stock) || 0,
        price: Number(price) || 0,
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

    const { id, entry_date, nozzle_readings, ugt_closing_stock, price, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const supabase = getServiceClient()

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (nozzle_readings) updates.nozzle_readings = nozzle_readings
    if (ugt_closing_stock !== undefined) updates.ugt_closing_stock = Number(ugt_closing_stock) || 0
    if (price !== undefined) updates.price = Number(price) || 0
    if (notes !== undefined) updates.notes = notes?.trim() || null

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

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const supabase = getServiceClient()
    await supabase.from(TABLE).delete().eq('id', id).eq('org_id', user.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
