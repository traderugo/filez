import { db } from '../db'
import { toServerPayload } from '../sync'

/**
 * Create a repository for an entry type.
 *
 * @param {string} tableName  - Dexie table name (e.g. 'dailySales')
 * @returns {{ create, update, remove, getById, getAll }}
 */
export function createRepository(tableName) {
  const table = db[tableName]

  return {
    /**
     * Create a new entry. Writes to IndexedDB, queues sync.
     * @param {object} record - Local camelCase record (must include orgId, entryDate, id)
     */
    async create(record) {
      await table.add(record)

      await db.syncQueue.add({
        table: tableName,
        operation: 'CREATE',
        orgId: record.orgId,
        payload: toServerPayload(tableName, record),
        createdAt: Date.now(),
      })

      return record
    },

    /**
     * Update an existing entry. Writes to IndexedDB, queues sync.
     * @param {object} record - Full local record with id
     */
    async update(record) {
      await table.put(record)

      await db.syncQueue.add({
        table: tableName,
        operation: 'UPDATE',
        orgId: record.orgId,
        payload: toServerPayload(tableName, record),
        createdAt: Date.now(),
      })

      return record
    },

    /**
     * Delete an entry. Removes from IndexedDB, queues sync.
     * @param {string} id - Entry UUID
     * @param {string} orgId - Org UUID (needed for API call)
     */
    async remove(id, orgId) {
      await table.delete(id)

      // Purge any pending CREATE/UPDATE for this entry so the sync engine
      // doesn't resurrect it before the DELETE is processed.
      const pending = await db.syncQueue.where('table').equals(tableName).toArray()
      for (const item of pending) {
        if (item.payload?.id === id && item.operation !== 'DELETE') {
          await db.syncQueue.delete(item.queueId)
        }
      }

      await db.syncQueue.add({
        table: tableName,
        operation: 'DELETE',
        orgId,
        payload: { id },
        createdAt: Date.now(),
      })
    },

    /**
     * Get a single entry by ID from IndexedDB.
     */
    async getById(id) {
      return table.get(id)
    },

    /**
     * Get all entries for an org, ordered by entryDate descending.
     * @param {string} orgId
     * @param {{ page?: number, limit?: number }} opts
     */
    async getAll(orgId, { page = 1, limit = 10 } = {}) {
      const all = await table
        .where('orgId')
        .equals(orgId)
        .reverse()
        .sortBy('entryDate')

      const total = all.length
      const start = (page - 1) * limit
      const entries = all.slice(start, start + limit)

      return { entries, total }
    },
  }
}
