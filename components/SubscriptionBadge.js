const statusColors = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  revoked: 'bg-gray-100 text-gray-600',
}

export default function SubscriptionBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
