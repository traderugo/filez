import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? profile : null
}

export async function GET(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('status')

    const client = getAdminClient()
    let query = client
      .from('subscriptions')
      .select('id, status, created_at, payment_reference, proof_url, notes, start_date, end_date, plan_type, total_amount, reference_code, payment_deadline, users(name, email, phone), subscription_items(id, service_name, price)')
      .order('created_at', { ascending: false })

    if (filter && filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    return NextResponse.json({ subscriptions: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, action, notes } = await request.json()
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    const today = new Date()
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 1)

    const updates = action === 'approve'
      ? {
          status: 'approved',
          start_date: today.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          notes: notes || null,
        }
      : {
          status: 'rejected',
          notes: notes || 'Rejected by admin',
        }

    const client = getAdminClient()
    const { error } = await client.from('subscriptions').update(updates).eq('id', id)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
