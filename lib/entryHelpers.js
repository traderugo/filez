import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

// Maps each entry type to its required service key
const ENTRY_SERVICE_MAP = {
  'daily-sales': 'fuel-operations',
  'product-receipt': 'fuel-operations',
  'lodgements': 'fuel-operations',
  'lube-sales': 'lube-management',
  'lube-stock': 'lube-management',
  'customer-payments': 'customer-payments',
}

export { ENTRY_SERVICE_MAP }

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function authenticateUser(request) {
  const user = await getPinUserFromRequest(request)
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!user.org_id) return { user: null, error: NextResponse.json({ error: 'You must belong to a station' }, { status: 403 }) }

  const { success } = rateLimit(`entries:${user.id}`, 30)
  if (!success) return { user: null, error: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }

  return { user, error: null }
}

/**
 * Check if the user's org has an approved subscription that includes the given service key.
 * Returns { subscribed: true } or { subscribed: false, error: NextResponse }.
 */
export async function requireService(user, serviceKey) {
  const supabase = getServiceClient()

  // Find the service id for the key
  const { data: service } = await supabase
    .from('services')
    .select('id')
    .eq('key', serviceKey)
    .single()

  if (!service) {
    return { subscribed: false, error: NextResponse.json({ error: 'Service not found' }, { status: 404 }) }
  }

  // Check if org owner has an approved subscription with this service
  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', user.org_id)
    .single()

  if (!org) {
    return { subscribed: false, error: NextResponse.json({ error: 'Station not found' }, { status: 404 }) }
  }

  const { data: items } = await supabase
    .from('subscription_items')
    .select('id, subscriptions!inner(status, user_id)')
    .eq('service_id', service.id)
    .eq('subscriptions.user_id', org.owner_id)
    .eq('subscriptions.status', 'approved')
    .limit(1)

  if (!items || items.length === 0) {
    return { subscribed: false, error: NextResponse.json({ error: 'Subscription required for this service' }, { status: 403 }) }
  }

  return { subscribed: true }
}

export function paginationParams(request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { page, limit, from, to, searchParams }
}
