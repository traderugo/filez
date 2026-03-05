import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

async function getAdminWithOrg(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, org_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin' || !profile.org_id) return null
  return profile
}

// GET: fetch all station config for admin's org
export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const admin = await getAdminWithOrg(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = admin.org_id
    const [pumps, tanks, banks, lubeProducts, consumptionCats] = await Promise.all([
      supabase.from('station_pumps').select('*').eq('org_id', orgId).order('sort_order'),
      supabase.from('station_tanks').select('*').eq('org_id', orgId).order('sort_order'),
      supabase.from('station_banks').select('*').eq('org_id', orgId).order('sort_order'),
      supabase.from('station_lube_products').select('*').eq('org_id', orgId).order('sort_order'),
      supabase.from('station_consumption_categories').select('*').eq('org_id', orgId).order('fuel_type, sort_order'),
    ])

    return NextResponse.json({
      pumps: pumps.data || [],
      tanks: tanks.data || [],
      banks: banks.data || [],
      lubeProducts: lubeProducts.data || [],
      consumptionCategories: consumptionCats.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: add item to a config table
export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await getAdminWithOrg(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`station-config:${admin.id}`, 30)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { table, ...fields } = await request.json()
    const orgId = admin.org_id

    const allowedTables = ['station_pumps', 'station_tanks', 'station_banks', 'station_lube_products', 'station_consumption_categories']
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
    }

    const row = { org_id: orgId }

    if (table === 'station_pumps') {
      if (!fields.fuel_type || !fields.pump_number) return NextResponse.json({ error: 'fuel_type and pump_number required' }, { status: 400 })
      row.fuel_type = fields.fuel_type
      row.pump_number = Number(fields.pump_number)
      row.initial_reading = Number(fields.initial_reading) || 0
    } else if (table === 'station_tanks') {
      if (!fields.fuel_type || !fields.tank_number) return NextResponse.json({ error: 'fuel_type and tank_number required' }, { status: 400 })
      row.fuel_type = fields.fuel_type
      row.tank_number = Number(fields.tank_number)
      row.capacity = Number(fields.capacity) || 0
    } else if (table === 'station_banks') {
      if (!fields.bank_name) return NextResponse.json({ error: 'bank_name required' }, { status: 400 })
      row.bank_name = fields.bank_name.trim()
    } else if (table === 'station_lube_products') {
      if (!fields.product_name) return NextResponse.json({ error: 'product_name required' }, { status: 400 })
      row.product_name = fields.product_name.trim()
      row.unit_price = Number(fields.unit_price) || 0
    } else if (table === 'station_consumption_categories') {
      if (!fields.fuel_type || !fields.category_name) return NextResponse.json({ error: 'fuel_type and category_name required' }, { status: 400 })
      row.fuel_type = fields.fuel_type
      row.category_name = fields.category_name.trim()
    }

    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already exists' }, { status: 409 })
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE: remove item from a config table
export async function DELETE(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await getAdminWithOrg(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { table, id } = await request.json()
    const allowedTables = ['station_pumps', 'station_tanks', 'station_banks', 'station_lube_products', 'station_consumption_categories']
    if (!allowedTables.includes(table) || !id) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    await supabase.from(table).delete().eq('id', id).eq('org_id', admin.org_id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
