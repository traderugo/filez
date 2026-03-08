import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient, paginationParams, requireService } from '@/lib/entryHelpers'

const TABLE = 'product_receipt_entries'
const SERVICE_KEY = 'fuel-operations'

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
      .select('*, users:created_by(name), tank:tank_id(id, fuel_type, tank_number)', { count: 'exact' })
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

    const body = await request.json()
    if (!body.entry_date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .insert({
        org_id: user.org_id,
        entry_date: body.entry_date,
        loaded_date: body.loaded_date || null,
        driver_name: body.driver_name?.trim() || null,
        waybill_number: body.waybill_number?.trim() || null,
        ticket_number: body.ticket_number?.trim() || null,
        truck_number: body.truck_number?.trim() || null,
        chart_ullage: Number(body.chart_ullage) || 0,
        chart_liquid_height: Number(body.chart_liquid_height) || 0,
        depot_ullage: Number(body.depot_ullage) || 0,
        depot_liquid_height: Number(body.depot_liquid_height) || 0,
        station_ullage: Number(body.station_ullage) || 0,
        station_liquid_height: Number(body.station_liquid_height) || 0,
        first_compartment: Number(body.first_compartment) || 0,
        second_compartment: Number(body.second_compartment) || 0,
        third_compartment: Number(body.third_compartment) || 0,
        actual_volume: Number(body.actual_volume) || 0,
        depot_name: body.depot_name?.trim() || null,
        tank_id: body.tank_id || null,
        notes: body.notes?.trim() || null,
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

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    const fields = [
      'entry_date', 'loaded_date', 'driver_name', 'waybill_number', 'ticket_number',
      'truck_number', 'depot_name', 'notes',
    ]
    const numericFields = [
      'chart_ullage', 'chart_liquid_height', 'depot_ullage', 'depot_liquid_height',
      'station_ullage', 'station_liquid_height', 'first_compartment', 'second_compartment',
      'third_compartment', 'actual_volume',
    ]

    fields.forEach((f) => { if (body[f] !== undefined) updates[f] = body[f]?.trim?.() || body[f] || null })
    numericFields.forEach((f) => { if (body[f] !== undefined) updates[f] = Number(body[f]) || 0 })
    if (body.tank_id !== undefined) updates.tank_id = body.tank_id || null

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', body.id)
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
