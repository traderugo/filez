import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

function generateReferenceCode(userId) {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  const short = userId.substring(0, 4).toUpperCase()
  return `SUB-${short}-${dd}${mm}-${rand}`
}

export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`subscription:${user.id}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { plan_type, total_amount, items } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Please select at least one service' }, { status: 400 })
    }

    if (total_amount == null || total_amount <= 0) {
      return NextResponse.json({ error: 'Invalid total amount' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Check for existing pending_payment or pending_approval subscription
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending_payment', 'pending_approval'])
      .limit(1)

    if (existing?.length > 0) {
      const s = existing[0]
      if (s.status === 'pending_payment') {
        return NextResponse.json({ error: 'You already have a pending subscription. Complete payment or cancel it first.', existingId: s.id }, { status: 409 })
      }
      return NextResponse.json({ error: 'You already have a subscription awaiting approval.' }, { status: 409 })
    }

    const referenceCode = generateReferenceCode(user.id)
    const deadline = new Date()
    deadline.setHours(deadline.getHours() + 48)

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        status: 'pending_payment',
        plan_type: plan_type || 'recurring',
        total_amount,
        reference_code: referenceCode,
        payment_deadline: deadline.toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create subscription', debug: error.message }, { status: 500 })
    }

    // Insert subscription items
    const rows = items
      .filter((item) => item.service_id && item.service_name)
      .map((item) => ({
        subscription_id: data.id,
        service_id: item.service_id,
        service_name: item.service_name,
        price: item.price ?? 0,
      }))

    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from('subscription_items').insert(rows)
      if (itemsError) {
        return NextResponse.json({ error: 'Failed to save subscription items', debug: itemsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ subscription: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error', debug: err.message }, { status: 500 })
  }
}
