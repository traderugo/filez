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

    const subRes = await supabase
      .from('subscriptions')
      .select('id, status, start_date, end_date, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    let orgPlanType = 'recurring'

    if (user.org_id) {
      const orgRes = await supabase
        .from('organizations')
        .select('plan_type')
        .eq('id', user.org_id)
        .single()
      orgPlanType = orgRes.data?.plan_type || 'recurring'
    }

    return NextResponse.json({
      profile: user,
      subscription: subRes.data?.[0] || null,
      orgPlanType,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
