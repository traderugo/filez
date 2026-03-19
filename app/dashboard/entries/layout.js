import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

export default function EntriesLayout({ children }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      {children}
    </Suspense>
  )
}
