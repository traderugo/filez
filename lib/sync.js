import { db } from './db'

// Maps local table names to API route paths
const TABLE_API_MAP = {
  dailySales:       'daily-sales',
  productReceipts:  'product-receipt',
  lodgements:       'lodgements',
  lubeSales:        'lube-sales',
  lubeStock:        'lube-stock',
  customerPayments: 'customer-payments',
  consumption:      'consumption',
}

let syncing = false
let syncTimer = null

/**
 * Process all queued operations, sending each to the matching API route.
 * Silently skips on network failure — will retry next cycle.
 */
export async function processQueue() {
  if (syncing) return
  syncing = true

  try {
    const pending = await db.syncQueue.orderBy('createdAt').toArray()
    if (!pending.length) return

    for (const item of pending) {
      const apiPath = TABLE_API_MAP[item.table]
      if (!apiPath) {
        // Unknown table — remove from queue
        await db.syncQueue.delete(item.queueId)
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
          // Sync succeeded — update local record with server response if CREATE/UPDATE
          if (item.operation !== 'DELETE') {
            const data = await res.json()
            if (data.entry && TABLE_API_MAP[item.table]) {
              // Update local record with any server-generated fields
              await db[item.table].put(normalizeEntry(item.table, data.entry, item.orgId))
            }
          }
          await db.syncQueue.delete(item.queueId)
        } else if (res.status >= 400 && res.status < 500) {
          // Client error (validation, auth) — discard to avoid infinite retry
          console.warn(`Sync: dropping item (${res.status})`, item)
          await db.syncQueue.delete(item.queueId)
        }
        // 5xx errors are silently skipped — will retry next cycle
      } catch (err) {
        if (err.name === 'AbortError') return
        // Network failure — stop processing, retry next cycle
        console.warn('Sync: network error, will retry', err.message)
        break
      }
    }
  } finally {
    syncing = false
  }
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
    case 'consumption':
      return {
        ...base,
        customerId: serverRecord.customer_id,
        quantity: serverRecord.quantity,
        fuelType: serverRecord.fuel_type,
        isPourBack: !!serverRecord.is_pour_back,
        price: serverRecord.price ?? 0,
      }
    default:
      return { ...base, ...serverRecord }
  }
}

/**
 * Convert a local camelCase record back to snake_case for the API.
 */
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
    case 'consumption':
      return {
        ...base,
        customer_id: localRecord.customerId,
        quantity: localRecord.quantity,
        fuel_type: localRecord.fuelType,
        is_pour_back: !!localRecord.isPourBack,
        price: localRecord.price ?? 0,
      }
    default:
      return { ...base, ...localRecord }
  }
}
