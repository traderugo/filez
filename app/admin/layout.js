import AdminSidebar from '@/components/AdminSidebar'

export default function AdminLayout({ children }) {
  return (
    <div className="flex flex-col sm:flex-row min-h-[calc(100vh-3.5rem)]">
      <AdminSidebar />
      <div className="flex-1 p-4 sm:p-6">{children}</div>
    </div>
  )
}
