import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Self-heal: if owner has no org_id, find their station and set it
    if (!user.org_id) {
      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single()
      if (ownedOrg) {
        await supabase.from('users').update({ org_id: ownedOrg.id }).eq('id', user.id)
        user.org_id = ownedOrg.id
      }
    }

    // Fetch latest subscription and global services in parallel
    const [subRes, svcRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id, status, start_date, end_date, created_at, reference_code, payment_deadline, proof_url, plan_type, total_amount')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('services')
        .select('id, name, description, price')
        .eq('is_active', true)
        .order('name'),
    ])

    return NextResponse.json({
      profile: user,
      subscription: subRes.data?.[0] || null,
      services: svcRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
