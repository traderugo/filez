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

// POST — save all onboarding data for a station
export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`onboard:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { org_id, location, nozzles, tanks, mappings, lodgements } = await request.json()

    if (!org_id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Verify user owns this station
    const { data: station } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', org_id)
      .eq('owner_id', user.id)
      .single()

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    // 1. Update station location
    if (location) {
      await supabase
        .from('organizations')
        .update({ location: location.trim() })
        .eq('id', org_id)
    }

    // 2. Save nozzles (clear existing first)
    await supabase.from('station_pumps').delete().eq('org_id', org_id)

    if (nozzles && nozzles.length > 0) {
      const nozzleRows = nozzles.map((n, i) => ({
        org_id,
        fuel_type: n.fuel_type,
        pump_number: n.pump_number,
        initial_reading: n.initial_reading || 0,
        sort_order: i,
      }))
      const { error: nozzleErr } = await supabase.from('station_pumps').insert(nozzleRows)
      if (nozzleErr) {
        return NextResponse.json({ error: 'Failed to save nozzles' }, { status: 500 })
      }
    }

    // 3. Save tanks (clear existing first)
    await supabase.from('station_tanks').delete().eq('org_id', org_id)

    if (tanks && tanks.length > 0) {
      const tankRows = tanks.map((t, i) => ({
        org_id,
        fuel_type: t.fuel_type,
        tank_number: t.tank_number,
        capacity: t.capacity || 0,
        opening_stock: t.opening_stock || 0,
        sort_order: i,
      }))
      const { data: savedTanks, error: tankErr } = await supabase
        .from('station_tanks')
        .insert(tankRows)
        .select('id, fuel_type, tank_number')
      if (tankErr) {
        return NextResponse.json({ error: 'Failed to save tanks' }, { status: 500 })
      }

      // 4. Apply tank-to-nozzle mappings
      if (mappings && mappings.length > 0 && savedTanks) {
        // Build a lookup: "fuel_type-tank_number" -> tank uuid
        const tankLookup = {}
        for (const t of savedTanks) {
          tankLookup[`${t.fuel_type}-${t.tank_number}`] = t.id
        }

        // Get freshly inserted nozzles
        const { data: savedNozzles } = await supabase
          .from('station_pumps')
          .select('id, fuel_type, pump_number')
          .eq('org_id', org_id)

        if (savedNozzles) {
          for (const m of mappings) {
            const tankId = tankLookup[`${m.fuel_type}-${m.tank_number}`]
            if (tankId) {
              await supabase
                .from('station_pumps')
                .update({ tank_id: tankId })
                .eq('org_id', org_id)
                .eq('fuel_type', m.fuel_type)
                .eq('pump_number', m.nozzle_pump_number)
            }
          }
        }
      }
    }

    // 5. Save lodgements (clear existing first)
    await supabase.from('station_banks').delete().eq('org_id', org_id)

    if (lodgements && lodgements.length > 0) {
      const lodgeRows = lodgements.map((l, i) => ({
        org_id,
        bank_name: l.bank_name,
        lodgement_type: l.lodgement_type,
        terminal_id: l.terminal_id || null,
        balance: l.balance || 0,
        sort_order: i,
      }))
      const { error: lodgeErr } = await supabase.from('station_banks').insert(lodgeRows)
      if (lodgeErr) {
        return NextResponse.json({ error: 'Failed to save lodgements' }, { status: 500 })
      }
    }

    // 6. Mark onboarding as complete
    await supabase
      .from('organizations')
      .update({ onboarding_complete: true })
      .eq('id', org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
