const statusColors = {
  approved: 'bg-green-100 text-green-700',
  pending_payment: 'bg-yellow-100 text-yellow-700',
  pending_approval: 'bg-blue-100 text-blue-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-600',
}

const statusLabels = {
  approved: 'Approved',
  pending_payment: 'Pending Payment',
  pending_approval: 'Pending Approval',
  expired: 'Expired',
  rejected: 'Rejected',
}

export default function SubscriptionBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabels[status] || status}
    </span>
  )
}
