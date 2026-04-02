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

db.version(2).stores({
  // ── Chat & activity log ──
  stationMessages:   'id, orgId, createdAt, type',
})

db.version(3).stores({
  // ── Drop consumption table (data now derived from daily sales nozzle readings) ──
  consumption:       null,
})

db.version(4).stores({
  // ── Access cache for offline permission checks ──
  accessCache:       'key',
})
