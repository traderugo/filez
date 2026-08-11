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
    <div className="max-w-2xl px-4 sm:px-8 py-8">
      <p className="text-sm text-content-muted mb-8">Select an entry type to view or create records.</p>

      <div className="grid gap-3">
        {entries.map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border border-line p-4 hover:border-primary-500/40 hover:bg-primary-50/50 transition-colors"
          >
            <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-content">{label}</p>
              <p className="text-xs text-content-muted">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
