import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'daily_sales_entries'
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
      const { data } = await supabase.from(TABLE).select('*, users:created_by(name)').eq('id', id).eq('org_id', user.org_id).is('deleted_at', null).single()
      return NextResponse.json({ entry: data })
    }

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name)', { count: 'exact' })
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
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
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, close_of_business } = await request.json()

    if (!entry_date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    if (!Array.isArray(nozzle_readings) || nozzle_readings.length === 0) {
      return NextResponse.json({ error: 'Nozzle readings are required' }, { status: 400 })
    }

    // Compute total UGT closing stock from per-tank readings (backward compat)
    const tankArr = Array.isArray(tank_readings) ? tank_readings : []
    const totalUgt = tankArr.length > 0
      ? tankArr.reduce((sum, t) => sum + (Number(t.closing_stock) || 0), 0)
      : Number(ugt_closing_stock) || 0

    // Normalize prices object { PMS: number, AGO: number, DPK: number }
    const safePrices = {
      PMS: Number(prices?.PMS) || 0,
      AGO: Number(prices?.AGO) || 0,
      DPK: Number(prices?.DPK) || 0,
    }

    const supabase = getServiceClient()

    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(id ? { id } : {}),
        org_id: user.org_id,
        entry_date,
        nozzle_readings,
        tank_readings: tankArr,
        ugt_closing_stock: totalUgt,
        prices: safePrices,
        notes: notes?.trim() || null,
        close_of_business: !!close_of_business,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, content: 'added a daily sales entry', actionType: 'created_entry' })
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

    const { id, entry_date, nozzle_readings, tank_readings, ugt_closing_stock, prices, notes, close_of_business } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const supabase = getServiceClient()

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (nozzle_readings) updates.nozzle_readings = nozzle_readings
    if (tank_readings !== undefined) {
      const tankArr = Array.isArray(tank_readings) ? tank_readings : []
      updates.tank_readings = tankArr
      updates.ugt_closing_stock = tankArr.reduce((sum, t) => sum + (Number(t.closing_stock) || 0), 0)
    } else if (ugt_closing_stock !== undefined) {
      updates.ugt_closing_stock = Number(ugt_closing_stock) || 0
    }
    if (prices !== undefined) {
      updates.prices = {
        PMS: Number(prices?.PMS) || 0,
        AGO: Number(prices?.AGO) || 0,
        DPK: Number(prices?.DPK) || 0,
      }
    }
    if (notes !== undefined) updates.notes = notes?.trim() || null
    if (close_of_business !== undefined) updates.close_of_business = !!close_of_business

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

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, content: 'updated a daily sales entry', actionType: 'updated_entry' })
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
    const now = new Date().toISOString()
    await supabase.from(TABLE).update({ deleted_at: now, updated_at: now }).eq('id', id).eq('org_id', user.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
