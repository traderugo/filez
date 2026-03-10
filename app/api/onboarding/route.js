import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

// Upsert helper: update items with id, insert new items, delete removed items
async function upsertConfigTable(supabase, table, orgId, items, buildRow) {
  // Get existing IDs for this org
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('org_id', orgId)

  const existingIds = new Set((existing || []).map((e) => e.id))
  const incomingIds = new Set()

  const toUpdate = []
  const toInsert = []

  for (let i = 0; i < items.length; i++) {
    const row = buildRow(items[i], i)
    if (items[i].id && existingIds.has(items[i].id)) {
      // Existing item — update
      toUpdate.push({ id: items[i].id, ...row })
      incomingIds.add(items[i].id)
    } else {
      // New item — insert
      toInsert.push({ org_id: orgId, ...row })
    }
  }

  // Delete items that were removed by user
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))

  // Execute
  for (const row of toUpdate) {
    const { id, ...fields } = row
    await supabase.from(table).update(fields).eq('id', id)
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from(table).insert(toInsert)
    if (error) return { error }
  }

  if (toDelete.length > 0) {
    await supabase.from(table).delete().in('id', toDelete)
  }

  return { error: null }
}

// POST — save all onboarding data for a station
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`onboard:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { org_id, location, station_group, nozzles, tanks, mappings, lodgements, lube_products, customers } = await request.json()

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

    // 1. Update station location and group
    const orgUpdate = {}
    if (location) orgUpdate.location = location.trim()
    if (station_group) orgUpdate.station_group = station_group.trim()
    if (Object.keys(orgUpdate).length > 0) {
      await supabase
        .from('organizations')
        .update(orgUpdate)
        .eq('id', org_id)
    }

    // 2. Upsert nozzles (station_pumps)
    if (nozzles) {
      const { error: nozzleErr } = await upsertConfigTable(
        supabase, 'station_pumps', org_id, nozzles,
        (n, i) => ({
          fuel_type: n.fuel_type,
          pump_number: n.pump_number,
          initial_reading: n.initial_reading || 0,
          sort_order: i,
        })
      )
      if (nozzleErr) {
        return NextResponse.json({ error: 'Failed to save nozzles' }, { status: 500 })
      }
    }

    // 3. Upsert tanks
    if (tanks) {
      const { error: tankErr } = await upsertConfigTable(
        supabase, 'station_tanks', org_id, tanks,
        (t, i) => ({
          fuel_type: t.fuel_type,
          tank_number: t.tank_number,
          capacity: t.capacity || 0,
          opening_stock: t.opening_stock || 0,
          sort_order: i,
        })
      )
      if (tankErr) {
        return NextResponse.json({ error: 'Failed to save tanks' }, { status: 500 })
      }
    }

    // 4. Apply tank-to-nozzle mappings
    if (mappings && mappings.length > 0 && tanks) {
      // Get current tanks and nozzles for this org
      const [{ data: savedTanks }, { data: savedNozzles }] = await Promise.all([
        supabase.from('station_tanks').select('id, fuel_type, tank_number').eq('org_id', org_id),
        supabase.from('station_pumps').select('id, fuel_type, pump_number').eq('org_id', org_id),
      ])

      if (savedTanks && savedNozzles) {
        const tankLookup = {}
        for (const t of savedTanks) {
          tankLookup[`${t.fuel_type}-${t.tank_number}`] = t.id
        }

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

    // 5. Upsert lodgements (station_banks)
    if (lodgements) {
      const { error: lodgeErr } = await upsertConfigTable(
        supabase, 'station_banks', org_id, lodgements,
        (l, i) => ({
          bank_name: l.bank_name,
          lodgement_type: l.lodgement_type,
          terminal_id: l.terminal_id || null,
          opening_balance: l.opening_balance ?? l.balance ?? 0,
          sort_order: i,
        })
      )
      if (lodgeErr) {
        return NextResponse.json({ error: 'Failed to save lodgements' }, { status: 500 })
      }
    }

    // 6. Upsert lube products
    if (lube_products) {
      const { error: lubeErr } = await upsertConfigTable(
        supabase, 'station_lube_products', org_id, lube_products,
        (lp, i) => ({
          product_name: lp.product_name,
          unit_price: lp.unit_price || 0,
          opening_stock: lp.opening_stock || 0,
          opening_date: lp.opening_date || new Date().toISOString().split('T')[0],
          sort_order: i,
        })
      )
      if (lubeErr) {
        return NextResponse.json({ error: 'Failed to save lube products' }, { status: 500 })
      }
    }

    // 7. Upsert credit customers
    if (customers) {
      const { error: custErr } = await upsertConfigTable(
        supabase, 'station_customers', org_id, customers,
        (c, i) => ({
          name: c.name,
          phone: c.phone || null,
          opening_balance: c.opening_balance || 0,
          opening_date: c.opening_date || new Date().toISOString().split('T')[0],
          sort_order: i,
        })
      )
      if (custErr) {
        return NextResponse.json({ error: 'Failed to save customers' }, { status: 500 })
      }
    }

    // 8. Mark onboarding as complete + ensure owner's org_id is set
    await Promise.all([
      supabase.from('organizations').update({ onboarding_complete: true }).eq('id', org_id),
      supabase.from('users').update({ org_id }).eq('id', user.id),
    ])

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
