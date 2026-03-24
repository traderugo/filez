import { db } from './db'

// Maps local table names to API route paths
const TABLE_API_MAP = {
  dailySales:       'daily-sales',
  productReceipts:  'product-receipt',
  lodgements:       'lodgements',
  lubeSales:        'lube-sales',
  lubeStock:        'lube-stock',
  customerPayments: 'customer-payments',
}

let syncing = false
let syncTimer = null

/**
 * Process all queued operations, sending each to the matching API route.
 * Silently skips on network failure — will retry next cycle.
 */
export async function processQueue() {
  if (syncing) return { pushed: 0, dropped: 0, errors: [] }
  syncing = true
  const result = { pushed: 0, dropped: 0, pending: 0, errors: [] }

  try {
    const pending = await db.syncQueue.orderBy('createdAt').toArray()
    if (!pending.length) return result

    for (const item of pending) {
      const apiPath = TABLE_API_MAP[item.table]
      if (!apiPath) {
        await db.syncQueue.delete(item.queueId)
        result.dropped++
        continue
      }

      const url = `/api/entries/${apiPath}?org_id=${item.orgId}`
      let method = 'POST'
      if (item.operation === 'UPDATE') method = 'PATCH'
      if (item.operation === 'DELETE') method = 'DELETE'

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        })

        if (res.ok) {
          if (item.operation !== 'DELETE') {
            const data = await res.json()
            if (data.entry && TABLE_API_MAP[item.table]) {
              const existing = await db[item.table].get(data.entry.id)
              // Don't re-add entry if it was deleted locally (a pending DELETE exists)
              const hasPendingDelete = existing === undefined && pending.some(
                p => p.table === item.table && p.operation === 'DELETE' && p.payload?.id === data.entry.id
              )
              if (!hasPendingDelete) {
                const normalized = normalizeEntry(item.table, data.entry, item.orgId)
                if (existing?.sourceKey) normalized.sourceKey = existing.sourceKey
                await db[item.table].put(normalized)
              }
            }
          }
          await db.syncQueue.delete(item.queueId)
          result.pushed++
        } else if (res.status === 400) {
          const body = await res.json().catch(() => ({}))
          const msg = `400: ${body.error || 'validation error'} (${item.table} ${item.operation})`
          console.warn('Sync: dropping invalid item', msg, item.payload)
          result.errors.push(msg)
          await db.syncQueue.delete(item.queueId)
          result.dropped++
        } else if (res.status === 401 || res.status === 403) {
          const msg = `${res.status}: auth/subscription error`
          result.errors.push(msg)
          result.pending = pending.length - result.pushed - result.dropped
          break
        } else if (res.status === 429) {
          // Rate limited — stop and retry later
          result.errors.push('429: rate limited, will retry later')
          result.pending = pending.length - result.pushed - result.dropped
          break
        } else if (res.status >= 402 && res.status < 500) {
          const body = await res.json().catch(() => ({}))
          const msg = `${res.status}: ${body.error || 'client error'} (${item.table})`
          result.errors.push(msg)
          await db.syncQueue.delete(item.queueId)
          result.dropped++
        } else if (res.status >= 500) {
          const msg = `${res.status}: server error (${item.table} ${item.operation})`
          result.errors.push(msg)
          result.pending = pending.length - result.pushed - result.dropped
          break
        }
      } catch (err) {
        if (err.name === 'AbortError') return result
        result.errors.push(`Network: ${err.message}`)
        result.pending = pending.length - result.pushed - result.dropped
        break
      }
    }
  } finally {
    syncing = false
  }
  return result
}

/**
 * Start the background sync loop (runs every 5 seconds).
 */
export function startSync() {
  if (syncTimer) return
  syncTimer = setInterval(processQueue, 5000)
  // Run immediately on start
  processQueue()
}

/**
 * Stop the background sync loop.
 */
export function stopSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

/**
 * Clear all pending sync queue items for an org.
 * For CREATE operations, also removes the entries from IndexedDB (reverting local state).
 * Returns a summary of what was cleared.
 */
export async function clearQueue(orgId) {
  const pending = await db.syncQueue.where('orgId').equals(orgId).toArray()
  if (!pending.length) return { cleared: 0, reverted: 0 }

  let reverted = 0

  for (const item of pending) {
    // For CREATEs, delete the entry from the local table to revert
    if (item.operation === 'CREATE' && item.payload?.id && TABLE_API_MAP[item.table]) {
      try {
        await db[item.table].delete(item.payload.id)
        reverted++
      } catch { /* entry may already be gone */ }
    }
    await db.syncQueue.delete(item.queueId)
  }

  return { cleared: pending.length, reverted }
}

/**
 * Normalize a server entry record into the local IndexedDB shape.
 * Converts snake_case server fields to camelCase local fields.
 */
export function normalizeEntry(table, serverRecord, orgId) {
  const base = {
    id: serverRecord.id,
    orgId: orgId || serverRecord.org_id,
    entryDate: serverRecord.entry_date,
    notes: serverRecord.notes || '',
    createdBy: serverRecord.created_by,
    createdAt: serverRecord.created_at,
    updatedAt: serverRecord.updated_at,
  }

  switch (table) {
    case 'dailySales':
      return {
        ...base,
        nozzleReadings: serverRecord.nozzle_readings || [],
        tankReadings: serverRecord.tank_readings || [],
        ugtClosingStock: serverRecord.ugt_closing_stock || 0,
        prices: serverRecord.prices || {},
        closeOfBusiness: serverRecord.close_of_business || false,
      }
    case 'productReceipts':
      return {
        ...base,
        loadedDate: serverRecord.loaded_date,
        driverName: serverRecord.driver_name,
        waybillNumber: serverRecord.waybill_number,
        ticketNumber: serverRecord.ticket_number,
        truckNumber: serverRecord.truck_number,
        chartUllage: serverRecord.chart_ullage,
        chartLiquidHeight: serverRecord.chart_liquid_height,
        depotUllage: serverRecord.depot_ullage,
        depotLiquidHeight: serverRecord.depot_liquid_height,
        stationUllage: serverRecord.station_ullage,
        stationLiquidHeight: serverRecord.station_liquid_height,
        firstCompartment: serverRecord.first_compartment,
        secondCompartment: serverRecord.second_compartment,
        thirdCompartment: serverRecord.third_compartment,
        actualVolume: serverRecord.actual_volume,
        depotName: serverRecord.depot_name,
        tankId: serverRecord.tank_id,
        arrivalTime: serverRecord.arrival_time || '',
        exitTime: serverRecord.exit_time || '',
      }
    case 'lodgements':
      return {
        ...base,
        amount: serverRecord.amount,
        bankId: serverRecord.bank_id,
        lodgementType: serverRecord.lodgement_type,
        salesDate: serverRecord.sales_date,
      }
    case 'lubeSales':
      return {
        ...base,
        productId: serverRecord.product_id,
        unitSold: serverRecord.unit_sold,
        unitReceived: serverRecord.unit_received,
        price: serverRecord.price,
      }
    case 'lubeStock':
      return {
        ...base,
        productId: serverRecord.product_id,
        stock: serverRecord.stock,
      }
    case 'customerPayments':
      return {
        ...base,
        customerId: serverRecord.customer_id,
        amountPaid: serverRecord.amount_paid,
        salesAmount: serverRecord.sales_amount,
      }
    default:
      return { ...base, ...serverRecord }
  }
}

/**
 * Convert a local camelCase record back to snake_case for the API.
 */
/**
 * One-time repair: re-queue all local entries for a table that may have been
 * dropped from the sync queue due to a server-side validation bug.
 * Uses a syncMeta flag so it only runs once per repair key.
 */
export async function repairSync(repairKey, table, orgId) {
  const flag = await db.syncMeta.get(repairKey)
  if (flag) return // already repaired

  const entries = await db[table].where('orgId').equals(orgId).toArray()
  if (entries.length) {
    for (const entry of entries) {
      const payload = toServerPayload(table, entry)
      await db.syncQueue.add({
        operation: 'CREATE',
        table,
        orgId,
        payload,
        createdAt: Date.now(),
      })
    }
  }

  await db.syncMeta.put({ key: repairKey, done: true, repairedAt: Date.now() })
}

export function toServerPayload(table, localRecord) {
  const base = {
    id: localRecord.id,
    entry_date: localRecord.entryDate,
    notes: localRecord.notes || '',
  }

  switch (table) {
    case 'dailySales':
      return {
        ...base,
        nozzle_readings: localRecord.nozzleReadings || [],
        tank_readings: localRecord.tankReadings || [],
        prices: localRecord.prices || {},
        close_of_business: localRecord.closeOfBusiness || false,
      }
    case 'productReceipts':
      return {
        ...base,
        loaded_date: localRecord.loadedDate,
        driver_name: localRecord.driverName,
        waybill_number: localRecord.waybillNumber,
        ticket_number: localRecord.ticketNumber,
        truck_number: localRecord.truckNumber,
        chart_ullage: localRecord.chartUllage,
        chart_liquid_height: localRecord.chartLiquidHeight,
        depot_ullage: localRecord.depotUllage,
        depot_liquid_height: localRecord.depotLiquidHeight,
        station_ullage: localRecord.stationUllage,
        station_liquid_height: localRecord.stationLiquidHeight,
        first_compartment: localRecord.firstCompartment,
        second_compartment: localRecord.secondCompartment,
        third_compartment: localRecord.thirdCompartment,
        actual_volume: localRecord.actualVolume,
        depot_name: localRecord.depotName,
        tank_id: localRecord.tankId,
        arrival_time: localRecord.arrivalTime || null,
        exit_time: localRecord.exitTime || null,
      }
    case 'lodgements':
      return {
        ...base,
        amount: localRecord.amount,
        bank_id: localRecord.bankId,
        lodgement_type: localRecord.lodgementType,
        sales_date: localRecord.salesDate,
      }
    case 'lubeSales':
      return {
        ...base,
        product_id: localRecord.productId,
        unit_sold: localRecord.unitSold,
        unit_received: localRecord.unitReceived,
        price: localRecord.price,
      }
    case 'lubeStock':
      return {
        ...base,
        product_id: localRecord.productId,
        stock: localRecord.stock,
      }
    case 'customerPayments':
      return {
        ...base,
        customer_id: localRecord.customerId,
        amount_paid: localRecord.amountPaid,
        sales_amount: localRecord.salesAmount,
      }
    default:
      return { ...base, ...localRecord }
  }
}
