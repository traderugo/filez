import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

const GRACE_PERIOD_DAYS = 7

export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ subscribed: false })

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const serviceKey = searchParams.get('service')

    if (!orgId || !serviceKey) return NextResponse.json({ subscribed: false })

    const supabase = getAdminClient()

    const { data: service } = await supabase
      .from('services')
      .select('id')
      .eq('key', serviceKey)
      .single()

    if (!service) return NextResponse.json({ subscribed: false })

    const { data: org } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', orgId)
      .single()

    if (!org) return NextResponse.json({ subscribed: false })

    // Check approved subscription
    const { data: approvedItems } = await supabase
      .from('subscription_items')
      .select('id, subscriptions!inner(status, user_id, org_id)')
      .eq('service_id', service.id)
      .eq('subscriptions.user_id', org.owner_id)
      .eq('subscriptions.org_id', orgId)
      .eq('subscriptions.status', 'approved')
      .limit(1)

    if (approvedItems?.length > 0) {
      return NextResponse.json({ subscribed: true, grace: false })
    }

    // Check grace period
    const graceCutoff = new Date()
    graceCutoff.setDate(graceCutoff.getDate() - GRACE_PERIOD_DAYS)

    const { data: expiredItems } = await supabase
      .from('subscription_items')
      .select('id, subscriptions!inner(status, user_id, org_id, end_date)')
      .eq('service_id', service.id)
      .eq('subscriptions.user_id', org.owner_id)
      .eq('subscriptions.org_id', orgId)
      .eq('subscriptions.status', 'expired')
      .gte('subscriptions.end_date', graceCutoff.toISOString())
      .limit(1)

    if (expiredItems?.length > 0) {
      return NextResponse.json({ subscribed: true, grace: true })
    }

    return NextResponse.json({ subscribed: false })
  } catch {
    return NextResponse.json({ subscribed: false })
  }
}
