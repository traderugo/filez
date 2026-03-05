import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 5 requests per 15 min per user
    const { success } = rateLimit(`subscription:${user.id}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { payment_reference, proof_url, plan_type, total_amount, items } = await request.json()

    if (!proof_url) {
      return NextResponse.json({ error: 'Proof URL is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Check for existing pending subscription
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(1)

    if (existing?.length > 0) {
      return NextResponse.json({ error: 'You already have a pending subscription' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        status: 'pending',
        payment_reference: payment_reference || null,
        proof_url,
        plan_type: plan_type || null,
        total_amount: total_amount ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
    }

    // Insert subscription items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const rows = items
        .filter((item) => item.service_id && item.service_name)
        .map((item) => ({
          subscription_id: data.id,
          service_id: item.service_id,
          service_name: item.service_name,
          price: item.price ?? 0,
        }))

      if (rows.length > 0) {
        await supabase.from('subscription_items').insert(rows)
      }
    }

    return NextResponse.json({ subscription: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
