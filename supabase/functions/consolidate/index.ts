// Supabase Edge Function — replaces /api/cron/consolidate
// Schedule: weekly on Sunday at 02:00 UTC via Supabase Cron (dashboard or pg_cron+pg_net)
//
// Deploy:  supabase functions deploy consolidate
// Auth:    Bearer <SUPABASE_SERVICE_ROLE_KEY>  (set automatically by Supabase Cron)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Only the service role key is accepted — rejects anonymous calls
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
  )

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffDate = cutoff.toISOString().split('T')[0]
  const newOpeningDate = new Date(cutoff.getTime() + 86400000).toISOString().split('T')[0]

  const results: Record<string, number | Record<string, number>> = {
    banks: 0, lube: 0, customers: 0, tanks: 0, pumps: 0, deleted: {},
  }

  try {
    // 1. Banks: opening_balance += SUM(lodgements) for old entries
    const { data: oldLodgements } = await supabase
      .from('lodgement_entries')
      .select('bank_id, amount')
      .lt('entry_date', cutoffDate)
      .not('bank_id', 'is', null)

    if (oldLodgements && oldLodgements.length > 0) {
      const bankTotals: Record<string, number> = {}
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
            .update({ opening_balance: Number(bank.opening_balance) + total, opening_date: newOpeningDate })
            .eq('id', bankId)
          ;(results.banks as number)++
        }
      }
    }

    // 2. Lube products: opening_stock += received - sold for old entries
    const { data: oldLubeSales } = await supabase
      .from('lube_sales_entries')
      .select('product_id, unit_sold, unit_received')
      .lt('entry_date', cutoffDate)
      .not('product_id', 'is', null)

    if (oldLubeSales && oldLubeSales.length > 0) {
      const lubeTotals: Record<string, number> = {}
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
            .update({ opening_stock: Number(product.opening_stock) + net, opening_date: newOpeningDate })
            .eq('id', productId)
          ;(results.lube as number)++
        }
      }
    }

    // 3. Customers: opening_balance += sales - payments for old entries
    const { data: oldPayments } = await supabase
      .from('customer_payment_entries')
      .select('customer_id, amount_paid, sales_amount')
      .lt('entry_date', cutoffDate)
      .not('customer_id', 'is', null)

    if (oldPayments && oldPayments.length > 0) {
      const custTotals: Record<string, number> = {}
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
            .update({ opening_balance: Number(customer.opening_balance) + net, opening_date: newOpeningDate })
            .eq('id', customerId)
          ;(results.customers as number)++
        }
      }
    }

    // 4. Tanks: opening_stock += receipts for old entries
    const { data: oldReceipts } = await supabase
      .from('product_receipt_entries')
      .select('tank_id, actual_volume')
      .lt('entry_date', cutoffDate)
      .not('tank_id', 'is', null)

    if (oldReceipts && oldReceipts.length > 0) {
      const tankTotals: Record<string, number> = {}
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
            .update({ opening_stock: Number(tank.opening_stock) + total, opening_date: newOpeningDate })
            .eq('id', tankId)
          ;(results.tanks as number)++
        }
      }
    }

    // 5. Pumps + Tanks: carry forward nozzle sales from old daily_sales_entries
    const { data: oldDailySales } = await supabase
      .from('daily_sales_entries')
      .select('nozzle_readings')
      .lt('entry_date', cutoffDate)

    if (oldDailySales && oldDailySales.length > 0) {
      const pumpMaxMeters: Record<string, number> = {}
      const pumpPourBacks: Record<string, number> = {}

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

      const pumpIds = Object.keys(pumpMaxMeters)
      if (pumpIds.length > 0) {
        const { data: pumps } = await supabase
          .from('station_pumps')
          .select('id, tank_id, initial_reading')
          .in('id', pumpIds)

        if (pumps) {
          const tankSoldTotals: Record<string, number> = {}

          for (const pump of pumps) {
            const maxMeter = pumpMaxMeters[pump.id]
            const pourBack = pumpPourBacks[pump.id] || 0
            const netSold = Math.max(maxMeter - Number(pump.initial_reading), 0) - pourBack

            await supabase
              .from('station_pumps')
              .update({ initial_reading: maxMeter, opening_date: newOpeningDate })
              .eq('id', pump.id)
            ;(results.pumps as number)++

            if (netSold > 0 && pump.tank_id) {
              tankSoldTotals[pump.tank_id] = (tankSoldTotals[pump.tank_id] || 0) + netSold
            }
          }

          for (const [tankId, soldTotal] of Object.entries(tankSoldTotals)) {
            const { data: tank } = await supabase
              .from('station_tanks')
              .select('opening_stock')
              .eq('id', tankId)
              .single()
            if (tank) {
              await supabase
                .from('station_tanks')
                .update({ opening_stock: Number(tank.opening_stock) - soldTotal })
                .eq('id', tankId)
            }
          }
        }
      }
    }

    // 6. Delete old entries across all 6 tables
    const tables = [
      'daily_sales_entries',
      'product_receipt_entries',
      'lodgement_entries',
      'lube_sales_entries',
      'lube_stock_entries',
      'customer_payment_entries',
    ]

    const deleted: Record<string, number> = {}
    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .lt('entry_date', cutoffDate)
      deleted[table] = count || 0
    }
    results.deleted = deleted

    return new Response(JSON.stringify({ ok: true, cutoffDate, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Consolidation failed', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
