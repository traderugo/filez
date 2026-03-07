'use client'

import Link from 'next/link'
import { FileSpreadsheet, ClipboardList, CreditCard, Droplets, Users } from 'lucide-react'

const entries = [
  { href: '/dashboard/entries/daily-sales', label: 'Daily Sales', desc: 'Nozzle readings, stock, and pricing', icon: FileSpreadsheet },
  { href: '/dashboard/entries/product-receipt', label: 'Product Receipt', desc: 'Deliveries, waybills, and compartments', icon: ClipboardList },
  { href: '/dashboard/entries/lodgements', label: 'Lodgements', desc: 'Deposits, lube deposits, and POS', icon: CreditCard },
  { href: '/dashboard/entries/lube', label: 'Lube', desc: 'Lube sales and stock entries', icon: Droplets },
  { href: '/dashboard/entries/customer-payments', label: 'Customer Payments', desc: 'Customer sales and payment records', icon: Users },
]

export default function EntriesIndexPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Entries</h1>
      <p className="text-sm text-gray-500 mb-8">Select an entry type to view or create records.</p>

      <div className="grid gap-3">
        {entries.map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border border-gray-200 rounded-md p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
          >
            <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
