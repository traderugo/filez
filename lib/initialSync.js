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
  if (!orgId) {
    console.warn('[initialSync] No orgId provided, skipping')
    return { skipped: true, reason: 'no-org-id' }
  }

  // Check if we already synced this org
  if (!force) {
    const meta = await db.syncMeta.get(`synced:${orgId}`)
    if (meta) {
      console.log('[initialSync] Already synced for', orgId, '— skipping (use force to re-download)')
      return { skipped: true, reason: 'already-synced' }
    }
  }

  console.log(`[initialSync] Starting sync for org ${orgId} (force=${force})`)

  // Safety: flush pending sync queue before overwriting local data
  // This ensures locally-created entries reach the server first
  try { await processQueue() } catch (e) { console.warn('[initialSync] processQueue failed:', e.message) }

  // Fetch config tables (no pagination, small datasets)
  const [nozzlesRes, tanksRes, banksRes, customersRes, productsRes] = await Promise.all([
    fetch(`/api/entries/nozzles?org_id=${orgId}`),
    fetch(`/api/entries/tanks?org_id=${orgId}`),
    fetch(`/api/entries/banks?org_id=${orgId}`),
    fetch(`/api/entries/customers?org_id=${orgId}`),
    fetch(`/api/entries/lube-products?org_id=${orgId}`),
  ])

  console.log('[initialSync] Config responses:', {
    nozzles: nozzlesRes.status,
    tanks: tanksRes.status,
    banks: banksRes.status,
    customers: customersRes.status,
    products: productsRes.status,
  })

  const [nozzlesData, tanksData, banksData, customersData, productsData] = await Promise.all([
    nozzlesRes.ok ? nozzlesRes.json() : { nozzles: [] },
    tanksRes.ok ? tanksRes.json() : { tanks: [] },
    banksRes.ok ? banksRes.json() : { banks: [] },
    customersRes.ok ? customersRes.json() : { customers: [] },
    productsRes.ok ? productsRes.json() : { products: [] },
  ])

  console.log('[initialSync] Config counts:', {
    nozzles: nozzlesData.nozzles?.length || 0,
    tanks: tanksData.tanks?.length || 0,
    banks: banksData.banks?.length || 0,
    customers: customersData.customers?.length || 0,
    products: productsData.products?.length || 0,
  })

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

  let totalEntries = 0
  for (const { api, table, key } of entryTypes) {
    try {
      const allEntries = await fetchAllPages(api, orgId)
      console.log(`[initialSync] ${api}: fetched ${allEntries.length} entries`)

      if (allEntries.length) {
        await db.transaction('rw', db[table], async () => {
          await db[table].where('orgId').equals(orgId).delete()
          await db[table].bulkAdd(
            allEntries.map(e => normalizeEntry(table, e, orgId))
          )
        })
        totalEntries += allEntries.length
      }
    } catch (err) {
      // If a specific entry type fails (e.g. 403 no subscription), skip it
      console.warn(`[initialSync] skipping ${api}:`, err.message)
    }
  }

  console.log(`[initialSync] Complete — ${totalEntries} total entries synced for org ${orgId}`)

  // Mark this org as synced
  await db.syncMeta.put({ key: `synced:${orgId}`, syncedAt: Date.now() })
  return { skipped: false, totalEntries }
}

/**
 * Paginate through all entries for a given API type.
 */
async function fetchAllPages(apiType, orgId) {
  const all = []
  let page = 1
  const limit = 50

  while (true) {
    const url = `/api/entries/${apiType}?org_id=${orgId}&page=${page}&limit=${limit}`
    const res = await fetch(url)

    if (res.status === 403) {
      console.warn(`[initialSync] ${apiType} page ${page}: 403 (no subscription or access)`)
      break
    }
    if (res.status === 401) {
      console.warn(`[initialSync] ${apiType}: 401 (not authenticated)`)
      break
    }
    if (!res.ok) {
      console.warn(`[initialSync] ${apiType} page ${page}: ${res.status}`)
      break
    }

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
