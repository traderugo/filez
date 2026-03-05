'use client'

import Link from 'next/link'
import { FileSpreadsheet, Droplets } from 'lucide-react'

const reports = [
  {
    href: '/dashboard/reports/dso',
    title: 'Daily Sales Operation',
    description: 'Sales, inventory, consumption, lodgement, and summary reports',
    icon: FileSpreadsheet,
  },
  {
    href: '/dashboard/reports/lube',
    title: 'Lube Logs',
    description: 'Lubricant sales, inventory, and lodgement tracking',
    icon: Droplets,
  },
]

export default function ReportsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Reports</h1>
      <div className="grid gap-4">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="flex items-start gap-4 border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
          >
            <report.icon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{report.title}</h2>
              <p className="text-xs text-gray-500 mt-1">{report.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
