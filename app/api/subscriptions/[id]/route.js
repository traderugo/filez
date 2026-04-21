import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getAdminClient()

    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('id, status, start_date, end_date, created_at, reference_code, payment_deadline, proof_url, plan_type, total_amount, org_id, verification_suffix')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    return NextResponse.json({ subscription: sub })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — upload proof (moves pending_payment → pending_approval)
export async function PATCH(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`sub-proof:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id } = await params
    const { proof_url, payment_reference } = await request.json()

    if (!proof_url || !proof_url.startsWith('https://')) {
      return NextResponse.json({ error: 'Valid proof URL is required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Verify ownership and status
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, status, payment_deadline')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (sub.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Proof can only be uploaded for pending payment subscriptions' }, { status: 400 })
    }

    // Check if deadline passed
    if (sub.payment_deadline && new Date(sub.payment_deadline) < new Date()) {
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', id)
      return NextResponse.json({ error: 'Payment deadline has passed. Please create a new subscription.' }, { status: 410 })
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        proof_url,
        payment_reference: payment_reference?.trim() || null,
        status: 'pending_approval',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }

    return NextResponse.json({ subscription: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — cancel a pending_payment subscription
export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const supabase = getAdminClient()

    // Only allow cancelling pending_payment subscriptions
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (sub.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Only pending payment subscriptions can be cancelled' }, { status: 400 })
    }

    // Delete subscription items first, then the subscription
    await supabase.from('subscription_items').delete().eq('subscription_id', id)
    await supabase.from('subscriptions').delete().eq('id', id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
