import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(request, { params }) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stationId } = await params
    const supabase = getAdminClient()

    // Verify ownership
    const { data: station } = await supabase
      .from('organizations')
      .select('id, name, location')
      .eq('id', stationId)
      .eq('owner_id', user.id)
      .single()

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    const [nozzlesRes, tanksRes, banksRes, lubeRes, customersRes] = await Promise.all([
      supabase
        .from('station_pumps')
        .select('id, fuel_type, pump_number, initial_reading, tank_id, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_tanks')
        .select('id, fuel_type, tank_number, capacity, opening_stock, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_banks')
        .select('id, bank_name, lodgement_type, terminal_id, opening_balance, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_lube_products')
        .select('id, product_name, unit_price, opening_stock, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_customers')
        .select('id, name, phone, opening_balance, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
    ])

    return NextResponse.json({
      station,
      nozzles: nozzlesRes.data || [],
      tanks: tanksRes.data || [],
      lodgements: banksRes.data || [],
      lube_products: lubeRes.data || [],
      customers: customersRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
