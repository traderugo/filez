import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Consolidate: carry forward old entry effects into opening balances, then delete entries >90 days.
// Run weekly via Vercel Cron.

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffDate = cutoff.toISOString().split('T')[0]
  const newOpeningDate = new Date(cutoff.getTime() + 86400000).toISOString().split('T')[0]

  const results = { banks: 0, lube: 0, customers: 0, tanks: 0, pumps: 0, deleted: {} }

  try {
    // 1. Banks: opening_balance += SUM(lodgements) for old entries
    const { data: oldLodgements } = await supabase
      .from('lodgement_entries')
      .select('bank_id, amount')
      .lt('entry_date', cutoffDate)
      .is('deleted_at', null)
      .not('bank_id', 'is', null)

    if (oldLodgements && oldLodgements.length > 0) {
      const bankTotals = {}
      for (const l of oldLodgements) {
        bankTotals[l.bank_id] = (bankTotals[l.bank_id] || 0) + Number(l.amount)
      }
      for (const [bankId, total] of Object.entries(bankTotals)) {
        const { data: bank } = await supabase
          .from('station_banks')
          .select('opening_balance')
          .eq('id', bankId)
          .single()
        if (bank) {
          await supabase
            .from('station_banks')
            .update({
              opening_balance: Number(bank.opening_balance) + total,
              opening_date: newOpeningDate,
            })
            .eq('id', bankId)
          results.banks++
        }
      }
    }

    // 2. Lube products: opening_stock += received - sold for old entries
    const { data: oldLubeSales } = await supabase
      .from('lube_sales_entries')
      .select('product_id, unit_sold, unit_received')
      .lt('entry_date', cutoffDate)
      .is('deleted_at', null)
      .not('product_id', 'is', null)

    if (oldLubeSales && oldLubeSales.length > 0) {
      const lubeTotals = {}
      for (const ls of oldLubeSales) {
        if (!lubeTotals[ls.product_id]) lubeTotals[ls.product_id] = 0
        lubeTotals[ls.product_id] += Number(ls.unit_received) - Number(ls.unit_sold)
      }
      for (const [productId, net] of Object.entries(lubeTotals)) {
        const { data: product } = await supabase
          .from('station_lube_products')
          .select('opening_stock')
          .eq('id', productId)
          .single()
        if (product) {
          await supabase
            .from('station_lube_products')
            .update({
              opening_stock: Number(product.opening_stock) + net,
              opening_date: newOpeningDate,
            })
            .eq('id', productId)
          results.lube++
        }
      }
    }

    // 3. Customers: opening_balance += sales - payments for old entries
    const { data: oldPayments } = await supabase
      .from('customer_payment_entries')
      .select('customer_id, amount_paid, sales_amount')
      .lt('entry_date', cutoffDate)
      .is('deleted_at', null)
      .not('customer_id', 'is', null)

    if (oldPayments && oldPayments.length > 0) {
      const custTotals = {}
      for (const cp of oldPayments) {
        if (!custTotals[cp.customer_id]) custTotals[cp.customer_id] = 0
        custTotals[cp.customer_id] += Number(cp.sales_amount) - Number(cp.amount_paid)
      }
      for (const [customerId, net] of Object.entries(custTotals)) {
        const { data: customer } = await supabase
          .from('station_customers')
          .select('opening_balance')
          .eq('id', customerId)
          .single()
        if (customer) {
          await supabase
            .from('station_customers')
            .update({
              opening_balance: Number(customer.opening_balance) + net,
              opening_date: newOpeningDate,
            })
            .eq('id', customerId)
          results.customers++
        }
      }
    }

    // 4. Tanks: opening_stock += receipts for old entries
    const { data: oldReceipts } = await supabase
      .from('product_receipt_entries')
      .select('tank_id, actual_volume')
      .lt('entry_date', cutoffDate)
      .is('deleted_at', null)
      .not('tank_id', 'is', null)

    if (oldReceipts && oldReceipts.length > 0) {
      const tankTotals = {}
      for (const r of oldReceipts) {
        tankTotals[r.tank_id] = (tankTotals[r.tank_id] || 0) + Number(r.actual_volume)
      }
      for (const [tankId, total] of Object.entries(tankTotals)) {
        const { data: tank } = await supabase
          .from('station_tanks')
          .select('opening_stock')
          .eq('id', tankId)
          .single()
        if (tank) {
          await supabase
            .from('station_tanks')
            .update({
              opening_stock: Number(tank.opening_stock) + total,
              opening_date: newOpeningDate,
            })
            .eq('id', tankId)
          results.tanks++
        }
      }
    }

    // 5. Pumps + Tanks: carry forward nozzle sales from old daily_sales_entries
    // Extract closing_meter and pour_back per pump from JSONB, then:
    //   a) Set pump.initial_reading = max closing_meter from old entries
    //   b) Subtract net nozzle sales from tank.opening_stock
    const { data: oldDailySales } = await supabase
      .from('daily_sales_entries')
      .select('nozzle_readings')
      .lt('entry_date', cutoffDate)
      .is('deleted_at', null)

    if (oldDailySales && oldDailySales.length > 0) {
      // Aggregate max closing_meter and total pour_back per pump
      const pumpMaxMeters = {}
      const pumpPourBacks = {}

      for (const entry of oldDailySales) {
        if (!entry.nozzle_readings) continue
        for (const nr of entry.nozzle_readings) {
          if (!nr.pump_id) continue
          const meter = Number(nr.closing_meter) || 0
          const pourBack = Number(nr.pour_back) || 0
          if (!pumpMaxMeters[nr.pump_id] || meter > pumpMaxMeters[nr.pump_id]) {
            pumpMaxMeters[nr.pump_id] = meter
          }
          pumpPourBacks[nr.pump_id] = (pumpPourBacks[nr.pump_id] || 0) + pourBack
        }
      }

      // Get pump details (initial_reading + tank_id) for affected pumps
      const pumpIds = Object.keys(pumpMaxMeters)
      if (pumpIds.length > 0) {
        const { data: pumps } = await supabase
          .from('station_pumps')
          .select('id, tank_id, initial_reading')
          .in('id', pumpIds)

        if (pumps) {
          // Calculate net sold per tank from old entries, and update pump initial_reading
          const tankSoldTotals = {}

          for (const pump of pumps) {
            const maxMeter = pumpMaxMeters[pump.id]
            const pourBack = pumpPourBacks[pump.id] || 0
            const oldInitial = Number(pump.initial_reading)
            const netSold = Math.max(maxMeter - oldInitial, 0) - pourBack

            // Update pump initial_reading to max closing_meter from deleted entries
            await supabase
              .from('station_pumps')
              .update({
                initial_reading: maxMeter,
                opening_date: newOpeningDate,
              })
              .eq('id', pump.id)
            results.pumps++

            // Accumulate net sold per tank
            if (netSold > 0 && pump.tank_id) {
              tankSoldTotals[pump.tank_id] = (tankSoldTotals[pump.tank_id] || 0) + netSold
            }
          }

          // Subtract nozzle sales from tank opening_stock
          for (const [tankId, soldTotal] of Object.entries(tankSoldTotals)) {
            const { data: tank } = await supabase
              .from('station_tanks')
              .select('opening_stock')
              .eq('id', tankId)
              .single()
            if (tank) {
              await supabase
                .from('station_tanks')
                .update({
                  opening_stock: Number(tank.opening_stock) - soldTotal,
                })
                .eq('id', tankId)
            }
          }
        }
      }
    }

    // 6. Delete old entries (all 6 tables)
    const tables = [
      'daily_sales_entries',
      'product_receipt_entries',
      'lodgement_entries',
      'lube_sales_entries',
      'lube_stock_entries',
      'customer_payment_entries',
    ]

    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .lt('entry_date', cutoffDate)
      results.deleted[table] = count || 0
    }

    return NextResponse.json({ ok: true, cutoffDate, results })
  } catch (err) {
    return NextResponse.json({ error: 'Consolidation failed' }, { status: 500 })
  }
}
