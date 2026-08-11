// State colours stay literal and semantic (green = good, amber = waiting, red = bad) —
// the design system treats those as meaning, not decoration, so they are not tokenised.
// Only the two neutral cases move: pending_approval becomes the brand scale, and rejected
// becomes the quiet surface. Each gains a dark variant, since a 100-weight tint on a dark
// background is unreadable.
const statusColors = {
  approved: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
  pending_payment: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300',
  pending_approval: 'bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300',
  expired: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  rejected: 'bg-subtle text-content-muted',
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
    // rounded-full is intended: the square-corner rule exempts pills and badges.
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusColors[status] || 'bg-subtle text-content-muted'}`}>
      {statusLabels[status] || status}
    </span>
  )
}
