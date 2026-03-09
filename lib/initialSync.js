import { db } from './db'
import { normalizeEntry, processQueue } from './sync'

/**
 * Download all data for an org from the server into IndexedDB.
 * Called once after login or when switching stations.
 *
 * Skips if already synced for this org (check syncMeta).
 * Pass force=true to re-download.
 */
export async function initialSync(orgId, { force = false } = {}) {
  if (!orgId) return

  // Check if we already synced this org
  if (!force) {
    const meta = await db.syncMeta.get(`synced:${orgId}`)
    if (meta) return
  }

  // Safety: flush pending sync queue before overwriting local data
  // This ensures locally-created entries reach the server first
  try { await processQueue() } catch (e) { /* offline — skip */ }

  // Fetch config tables (no pagination, small datasets)
  const [nozzlesRes, tanksRes, banksRes, customersRes, productsRes] = await Promise.all([
    fetch(`/api/entries/nozzles?org_id=${orgId}`),
    fetch(`/api/entries/tanks?org_id=${orgId}`),
    fetch(`/api/entries/banks?org_id=${orgId}`),
    fetch(`/api/entries/customers?org_id=${orgId}`),
    fetch(`/api/entries/lube-products?org_id=${orgId}`),
  ])

  const [nozzlesData, tanksData, banksData, customersData, productsData] = await Promise.all([
    nozzlesRes.ok ? nozzlesRes.json() : { nozzles: [] },
    tanksRes.ok ? tanksRes.json() : { tanks: [] },
    banksRes.ok ? banksRes.json() : { banks: [] },
    customersRes.ok ? customersRes.json() : { customers: [] },
    productsRes.ok ? productsRes.json() : { products: [] },
  ])

  // Store config tables
  await db.transaction('rw', [db.nozzles, db.tanks, db.banks, db.customers, db.lubeProducts], async () => {
    // Clear old data for this org before inserting fresh
    await db.nozzles.where('orgId').equals(orgId).delete()
    await db.tanks.where('orgId').equals(orgId).delete()
    await db.banks.where('orgId').equals(orgId).delete()
    await db.customers.where('orgId').equals(orgId).delete()
    await db.lubeProducts.where('orgId').equals(orgId).delete()

    if (nozzlesData.nozzles?.length) {
      await db.nozzles.bulkAdd(nozzlesData.nozzles.map(n => ({ ...n, orgId })))
    }
    if (tanksData.tanks?.length) {
      await db.tanks.bulkAdd(tanksData.tanks.map(t => ({ ...t, orgId })))
    }
    if (banksData.banks?.length) {
      await db.banks.bulkAdd(banksData.banks.map(b => ({ ...b, orgId })))
    }
    if (customersData.customers?.length) {
      await db.customers.bulkAdd(customersData.customers.map(c => ({ ...c, orgId })))
    }
    if (productsData.products?.length) {
      await db.lubeProducts.bulkAdd(productsData.products.map(p => ({ ...p, orgId })))
    }
  })

  // Fetch all entries for each type (paginate through everything)
  const entryTypes = [
    { api: 'daily-sales',       table: 'dailySales',       key: 'entries' },
    { api: 'product-receipt',   table: 'productReceipts',  key: 'entries' },
    { api: 'lodgements',        table: 'lodgements',       key: 'entries' },
    { api: 'lube-sales',        table: 'lubeSales',        key: 'entries' },
    { api: 'lube-stock',        table: 'lubeStock',        key: 'entries' },
    { api: 'customer-payments', table: 'customerPayments', key: 'entries' },
    { api: 'consumption',       table: 'consumption',       key: 'entries' },
  ]

  for (const { api, table, key } of entryTypes) {
    try {
      const allEntries = await fetchAllPages(api, orgId)

      if (allEntries.length) {
        await db.transaction('rw', db[table], async () => {
          await db[table].where('orgId').equals(orgId).delete()
          await db[table].bulkAdd(
            allEntries.map(e => normalizeEntry(table, e, orgId))
          )
        })
      }
    } catch (err) {
      // If a specific entry type fails (e.g. 403 no subscription), skip it
      console.warn(`initialSync: skipping ${api}`, err.message)
    }
  }

  // Mark this org as synced
  await db.syncMeta.put({ key: `synced:${orgId}`, syncedAt: Date.now() })
}

/**
 * Paginate through all entries for a given API type.
 */
async function fetchAllPages(apiType, orgId) {
  const all = []
  let page = 1
  const limit = 50

  while (true) {
    const res = await fetch(`/api/entries/${apiType}?org_id=${orgId}&page=${page}&limit=${limit}`)

    if (res.status === 403) break // No subscription — skip this type
    if (!res.ok) break

    const data = await res.json()
    const entries = data.entries || []
    all.push(...entries)

    if (entries.length < limit) break // Last page
    page++
  }

  return all
}

/**
 * Clear all local data for an org (used on logout or station switch).
 */
export async function clearLocalData(orgId) {
  const tables = [
    db.dailySales, db.productReceipts, db.lodgements,
    db.lubeSales, db.lubeStock, db.customerPayments, db.consumption,
    db.nozzles, db.tanks, db.banks, db.customers, db.lubeProducts,
  ]

  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.where('orgId').equals(orgId).delete()
    }
  })

  await db.syncMeta.delete(`synced:${orgId}`)
}
