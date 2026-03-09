import Dexie from 'dexie'

export const db = new Dexie('StationPortal')

db.version(1).stores({
  // ── Entry tables (mirror server schema) ──
  dailySales:        'id, orgId, entryDate, createdAt',
  productReceipts:   'id, orgId, entryDate, createdAt',
  lodgements:        'id, orgId, entryDate, createdAt',
  lubeSales:         'id, orgId, entryDate, productId, createdAt',
  lubeStock:         'id, orgId, entryDate, productId, createdAt',
  customerPayments:  'id, orgId, entryDate, customerId, createdAt',
  consumption:       'id, orgId, entryDate, customerId, createdAt',

  // ── Config tables (downloaded on initial sync) ──
  nozzles:           'id, orgId',
  tanks:             'id, orgId',
  banks:             'id, orgId',
  lubeProducts:      'id, orgId',
  customers:         'id, orgId',

  // ── Sync queue ──
  syncQueue:         '++queueId, table, operation, orgId, createdAt',

  // ── Metadata ──
  syncMeta:          'key',
})
