import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'
import { checkBankAlerts, markAsRead } from '@/lib/payment/gmail-checker'
import { findBestMatch } from '@/lib/payment/matcher'

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`verify-bank:${user.id}`, 6)
    if (!success) {
      return NextResponse.json({ error: 'Please wait before trying again', verified: false }, { status: 429 })
    }

    const supabase = getAdminClient()
    const { id } = await params

    // Fetch subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, user_id, status, total_amount, verification_suffix, months, created_at')
      .eq('id', id)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (subscription.status !== 'pending_payment') {
      return NextResponse.json({
        verified: subscription.status === 'approved',
        status: subscription.status,
        message: subscription.status === 'approved'
          ? 'Subscription is already active.'
          : subscription.status === 'pending_approval'
            ? 'Payment proof uploaded, awaiting approval.'
            : `Subscription status: ${subscription.status}`,
      })
    }

    // Check Gmail for alerts
    let alerts
    try {
      alerts = await checkBankAlerts()
    } catch (gmailError) {
      console.error('Gmail API error:', gmailError.message)
      return NextResponse.json({
        verified: false,
        message: 'Could not check bank alerts right now. Please upload payment proof instead.',
      })
    }

    if (alerts.length === 0) {
      return NextResponse.json({
        verified: false,
        message: 'No new bank alerts found. Please wait 1-2 minutes after payment and try again.',
      })
    }

    // Run matching algorithm — total_amount already includes the verification suffix
    const result = findBestMatch(
      { id: subscription.id, amount_paid: subscription.total_amount, created_at: subscription.created_at },
      alerts
    )

    if (result.matched && result.alert) {
      // AUTO-VERIFY — approve subscription (same logic as admin approve)
      const now = new Date()
      const subMonths = subscription.months || 1
      const endDate = new Date(now)
      endDate.setMonth(endDate.getMonth() + subMonths)

      await supabase
        .from('subscriptions')
        .update({
          status: 'approved',
          start_date: now.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          verification_confidence: result.confidence,
          verified_by: 'automatic',
        })
        .eq('id', subscription.id)

      // Mark email as read
      try { await markAsRead(result.alert.messageId) } catch {}

      return NextResponse.json({
        verified: true,
        status: 'approved',
        message: 'Payment verified and subscription activated!',
        confidence: result.confidence,
      })
    }

    // No match — tell user to upload proof
    return NextResponse.json({
      verified: false,
      message: result.reason || 'Payment not matched. Please upload payment proof instead.',
      confidence: result.confidence,
    })

  } catch (error) {
    console.error('Bank verification error:', error)
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
