import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const user = await getPinUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { searchParams } = new URL(request.url)
  const org_id = searchParams.get('org_id') || user.org_id
  const debug = { user_id: user.id, org_id }

  // Step 1: Find service
  const { data: services } = await supabase.from('services').select('id, key, name')
  debug.services = services

  // Step 2: Find org
  const { data: org } = await supabase
    .from('organizations')
    .select('id, owner_id, name')
    .eq('id', org_id)
    .single()
  debug.org = org

  // Step 3: Find ALL subscriptions for this user
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id, user_id, org_id, status, start_date, end_date')
    .eq('user_id', user.id)
  debug.user_subscriptions = subs

  // Step 4: Find subscriptions for org owner (if different)
  if (org && org.owner_id !== user.id) {
    const { data: ownerSubs } = await supabase
      .from('subscriptions')
      .select('id, user_id, org_id, status, start_date, end_date')
      .eq('user_id', org.owner_id)
    debug.owner_subscriptions = ownerSubs
  }

  // Step 5: Find subscription_items for any approved sub
  if (subs?.length > 0) {
    const subIds = subs.map((s) => s.id)
    const { data: items } = await supabase
      .from('subscription_items')
      .select('id, subscription_id, service_id, service_name')
      .in('subscription_id', subIds)
    debug.subscription_items = items
  }

  // Step 6: Run the exact query from requireService for fuel-operations
  const fuelService = services?.find((s) => s.key === 'fuel-operations')
  if (fuelService && org) {
    const { data: matchItems, error: matchErr } = await supabase
      .from('subscription_items')
      .select('id, subscriptions!inner(status, user_id)')
      .eq('service_id', fuelService.id)
      .eq('subscriptions.user_id', org.owner_id)
      .eq('subscriptions.status', 'approved')
      .limit(1)
    debug.requireService_result = { items: matchItems, error: matchErr?.message || null }
  }

  return NextResponse.json(debug)
}
