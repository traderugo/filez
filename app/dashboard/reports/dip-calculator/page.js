'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Calculator } from 'lucide-react'
import Link from 'next/link'

export default function DipCalculatorPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <DipCalculatorContent />
    </Suspense>
  )
}

function DipCalculatorContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[800px] mx-auto px-4 sm:px-6">
      <div className="shrink-0 py-4 flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900 mr-auto">Dip Calculator</h1>
        <Link
          href={`/dashboard/reports/product-received?org_id=${orgId}`}
          className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Product Received
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <Calculator className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm">Ullage and liquid height calculator coming soon.</p>
      </div>
    </div>
  )
}
