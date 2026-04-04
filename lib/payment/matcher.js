/**
 * Smart matching algorithm for bank transfer verification.
 * Matches pending subscriptions against Gmail bank alert emails
 * using unique suffixed amount (80%) and time window (20%).
 *
 * Each subscription has a verification suffix (1-99) added to the base price,
 * making the transfer amount unique. This is the primary matching signal.
 */

/**
 * Check if two amounts match within tolerance (±₦1).
 */
function amountsMatch(a, b, tolerance = 1) {
  return Math.abs(a - b) < tolerance
}

/**
 * Check if two dates are within a time window (default 60 minutes).
 */
function withinTimeWindow(date1, date2, windowMinutes = 60) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffMs = Math.abs(d1.getTime() - d2.getTime())
  return diffMs / 1000 / 60 <= windowMinutes
}

/**
 * Find the best matching bank alert for a subscription payment.
 *
 * @param {Object} subscription - { id, amount_paid, created_at }
 * @param {Array} alerts - [{ senderName, amount, date, messageId }]
 * @returns {{ matched: boolean, confidence: number, alert?: object, reason?: string }}
 */
export function findBestMatch(subscription, alerts) {
  const subAmount = parseFloat(subscription.amount_paid)
  let bestMatch = null
  let bestConfidence = 0

  for (const alert of alerts) {
    const amountScore = amountsMatch(subAmount, alert.amount) ? 1.0 : 0.0
    const timeScore = withinTimeWindow(subscription.created_at, alert.date) ? 1.0 : 0.0

    // Weighted confidence: amount is the primary signal (unique suffixed amount)
    const confidence = (amountScore * 0.8) + (timeScore * 0.2)

    if (confidence > bestConfidence) {
      bestConfidence = confidence
      bestMatch = alert
    }
  }

  if (bestConfidence >= 0.8 && bestMatch) {
    return { matched: true, confidence: bestConfidence, alert: bestMatch }
  }

  return {
    matched: false,
    confidence: bestConfidence,
    reason: bestConfidence > 0.5
      ? `Low confidence (${(bestConfidence * 100).toFixed(0)}%) — please upload payment proof instead.`
      : 'No matching payment found. Please wait 1-2 minutes after paying and try again.',
  }
}
