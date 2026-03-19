'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Pencil, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { db } from '@/lib/db'
import { consumptionRepo } from '@/lib/repositories/consumption'
import Modal from '@/components/Modal'

export default function ConsumptionListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [page, setPage] = useState(1)
  const [ready, setReady] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [repairModal, setRepairModal] = useState(null)
  const limit = 10

  useEffect(() => { setReady(true) }, [orgId])

  const allEntries = useLiveQuery(
    () => ready && orgId ? db.consumption.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const customersMap = useLiveQuery(
    () => ready && orgId
      ? db.customers.where('orgId').equals(orgId).toArray().then(arr => Object.fromEntries(arr.map(c => [c.id, c.name || 'Unknown'])))
      : {},
    [orgId, ready], {}
  )

  const repairConsumption = async () => {
    if (repairing || !orgId) return
    setRepairing(true)
    let created = 0
    try {
      // 1. Delete ALL non-pour-back consumption entries (wipe clean)
      const allCons = await db.consumption
        .where('orgId').equals(orgId)
        .filter(c => !c.isPourBack)
        .toArray()
      for (const old of allCons) {
        await consumptionRepo.remove(old.id, orgId)
      }

      // 2. Build default customer map by fuel type (PMS → Manager Car, AGO → Generator)
      const allCustomers = await db.customers.where('orgId').equals(orgId).toArray()
      const defaultByFuel = {}
      for (const c of allCustomers) {
        const name = (c.name || '').toLowerCase()
        if (name === 'manager car') defaultByFuel['PMS'] = c.id
        if (name === 'generator') defaultByFuel['AGO'] = c.id
      }

      // 3. Recreate from daily sales nozzle readings
      const allSales = await db.dailySales.where('orgId').equals(orgId).toArray()
      const now = new Date().toISOString()
      let autoAssigned = 0

      for (const sale of allSales) {
        const readings = sale.nozzleReadings || []
        let saleUpdated = false
        for (const r of readings) {
          const qty = Number(r.consumption) || 0
          if (!qty) continue
          let custId = r.consumption_customer_id
          const ft = r.fuel_type || ''

          // Auto-assign default customer if missing
          if (!custId && defaultByFuel[ft]) {
            custId = defaultByFuel[ft]
            r.consumption_customer_id = custId
            saleUpdated = true
            autoAssigned++
          }
          if (!custId) continue

          const price = Number(sale.prices?.[ft]) || 0
          await consumptionRepo.create({
            id: crypto.randomUUID(),
            sourceKey: `${sale.id}_${r.pump_id}`,
            orgId,
            entryDate: sale.entryDate,
            customerId: custId,
            quantity: qty,
            fuelType: ft,
            isPourBack: false,
            price,
            notes: `${r.nozzle_label || ''} consumption`,
            createdAt: now,
            updatedAt: now,
          })
          created++
        }
        // Persist the auto-assigned customer_id back to the daily sales entry
        if (saleUpdated) {
          await db.dailySales.put({ ...sale, nozzleReadings: readings, updatedAt: now })
        }
      }
      const lines = [
        `Deleted ${allCons.length} old entries`,
        `Scanned ${allSales.length} daily sales entries`,
        `Created ${created} consumption entries`,
      ]
      if (autoAssigned) lines.push(`Auto-assigned customer on ${autoAssigned} nozzle readings (PMS→Manager Car, AGO→Generator)`)
      setRepairModal({ title: 'Rebuild Complete', lines })
    } catch (err) {
      setRepairModal({ title: 'Rebuild Failed', lines: [err.message] })
    }
    setRepairing(false)
  }

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => {
      const consumed = entries.filter(e => !e.isPourBack)
      const pourBack = entries.filter(e => e.isPourBack)
      return { date, entries, consumed, pourBack }
    })
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (!ready) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-end mb-6">
        <button onClick={repairConsumption} disabled={repairing} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 font-medium hover:bg-gray-50 disabled:opacity-50">
          {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Rebuild from Daily Sales
        </button>
      </div>

      {pageGroups.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No consumption entries yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {pageGroups.map((group) => (
              <div key={group.date} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {group.date !== 'no-date' ? format(new Date(group.date + 'T00:00:00'), 'MMM d, yyyy') : 'No date'}
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.consumed.length > 0 && group.consumed.map((e, i) => (
                      <span key={e.id}>
                        {i > 0 && ' · '}
                        {customersMap[e.customerId] || 'Unknown'}: {Number(e.quantity).toLocaleString()}L {e.fuelType}
                      </span>
                    ))}
                  </p>
                  {group.pourBack.length > 0 && (
                    <p className="text-xs text-orange-500 mt-0.5">
                      Pour back: {group.pourBack.map((e, i) => (
                        <span key={e.id}>
                          {i > 0 && ' · '}
                          {customersMap[e.customerId] || 'Unknown'}: {Number(e.quantity).toLocaleString()}L {e.fuelType}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <Link href={`/dashboard/entries/daily-sales?${qs}&edit_date=${group.date}`} className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /> Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}

      <Modal open={!!repairModal} onClose={() => setRepairModal(null)} title={repairModal?.title || 'Repair'}>
        <div className="space-y-2">
          {repairModal?.lines.map((line, i) => (
            <p key={i} className="text-sm text-gray-700">{line}</p>
          ))}
          <button onClick={() => setRepairModal(null)} className="w-full mt-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">OK</button>
        </div>
      </Modal>
    </div>
  )
}
