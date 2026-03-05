import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 5 requests per 15 min per user
    const { success } = rateLimit(`subscription:${user.id}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { payment_reference, proof_url } = await request.json()

    if (!proof_url) {
      return NextResponse.json({ error: 'Proof URL is required' }, { status: 400 })
    }

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
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
    }

    return NextResponse.json({ subscription: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
