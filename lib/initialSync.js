import { db } from './db'
import { normalizeEntry, processQueue } from './sync'

// Bump this to force every device to run one fresh full backfill. Devices whose stored
// `synced:` record predates the current version are treated as un-synced and re-download,
// which is how already-corrupted mirrors (partial history) heal themselves on next open.
export const SYNC_VERSION = 2

/**
 * Download all data for an org from the server into IndexedDB.
 * Called once after login or when switching stations.
 *
 * Skips only if this org was fully synced at the CURRENT SYNC_VERSION. A partial sync never
 * writes the flag, and an older-version flag is ignored, so both retry.
 * Pass force=true to re-download.
 */
export async function initialSync(orgId, { force = false } = {}) {
  if (!orgId) return { skipped: true, reason: 'no-org-id' }

  // Skip only when a completed sync exists AT THE CURRENT VERSION.
  if (!force) {
    const meta = await db.syncMeta.get(`synced:${orgId}`)
    if (meta && meta.version === SYNC_VERSION) return { skipped: true, reason: 'already-synced' }
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

  // Customers must load successfully — otherwise reports show "Unknown" everywhere
  if (!customersRes.ok) {
    const body = await customersRes.json().catch(() => ({}))
    throw new Error(`initialSync: customers fetch failed (${customersRes.status})${body.error ? `: ${body.error}` : ''}`)
  }

  const [nozzlesData, tanksData, banksData, customersData, productsData] = await Promise.all([
    nozzlesRes.ok ? nozzlesRes.json() : { nozzles: [] },
    tanksRes.ok ? tanksRes.json() : { tanks: [] },
    banksRes.ok ? banksRes.json() : { banks: [] },
    customersRes.json(),
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
  ]

  const serverCounts = {}
  const failedTypes = []
  for (const { api, table, key } of entryTypes) {
    try {
      const allEntries = (await fetchAllPages(api, orgId))
        .filter(e => !e.deleted_at) // Exclude soft-deleted entries
      serverCounts[table] = allEntries.length

      if (allEntries.length) {
        await db.transaction('rw', db[table], async () => {
          await db[table].where('orgId').equals(orgId).delete()
          await db[table].bulkPut(
            allEntries.map(e => normalizeEntry(table, e, orgId))
          )
        })
      }
    } catch (err) {
      // A network/server error mid-pagination means we do NOT have the full history for this
      // type. Keep whatever came down as a cache, but record the failure so we do not mark the
      // org synced below — otherwise a partial mirror gets locked in and every cumulative /
      // opening-balance figure is computed over missing data, differently on each device.
      console.warn(`initialSync: ${api} incomplete, will retry`, err.message)
      serverCounts[table] = `error: ${err.message}`
      failedTypes.push(api)
    }
  }

  // Only mark synced when every type came down cleanly. If any type failed, leave the org
  // unmarked so the next initialSync retries and fills the gap.
  const complete = failedTypes.length === 0
  if (complete) {
    await db.syncMeta.put({ key: `synced:${orgId}`, syncedAt: Date.now(), version: SYNC_VERSION })
  }
  return { serverCounts, complete, failedTypes }
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

    if (res.status === 403) break // No subscription for this type — legitimate skip
    // Any other non-OK response is a real failure. Do NOT treat it as "end of data": throw so
    // the caller knows this type is incomplete and must not be marked synced.
    if (!res.ok) throw new Error(`fetchAllPages(${apiType}): HTTP ${res.status} on page ${page}`)

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
    db.lubeSales, db.lubeStock, db.customerPayments,
    db.nozzles, db.tanks, db.banks, db.customers, db.lubeProducts,
  ]

  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.where('orgId').equals(orgId).delete()
    }
  })

  await db.syncMeta.delete(`synced:${orgId}`)
}
