import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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
  // Get Supabase session from cookies
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Load profile from public.users
  const svc = getServiceClient()
  const { data: profile } = await svc
    .from('users')
    .select('id, email, name, phone, role, org_id')
    .eq('id', authUser.id)
    .single()

  const user = profile
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { success } = rateLimit(`entries:${user.id}`, 200)
  if (!success) return { user: null, error: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }

  // Get org_id from query param (?org_id=...) — required for all entry operations
  const { searchParams } = new URL(request.url)
  const org_id = searchParams.get('org_id') || user.org_id
  if (!org_id) return { user: null, error: NextResponse.json({ error: 'Station is required' }, { status: 400 }) }

  // Verify user has access: owns station OR has accepted invite
  const supabase = getServiceClient()
  const { data: station } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .eq('id', org_id)
    .single()

  if (!station) return { user: null, error: NextResponse.json({ error: 'Station not found' }, { status: 404 }) }

  const isOwner = station.owner_id === user.id
  if (!isOwner) {
    const { data: invite } = await supabase
      .from('org_invites')
      .select('id')
      .eq('org_id', org_id)
      .eq('email', user.email)
      .eq('status', 'accepted')
      .single()

    if (!invite) return { user: null, error: NextResponse.json({ error: 'You do not have access to this station' }, { status: 403 }) }
  }

  // Attach org_id to user for downstream use
  user.org_id = org_id

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

  // Check if this station has an approved subscription with this service
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
    .select('id, subscriptions!inner(status, user_id, org_id)')
    .eq('service_id', service.id)
    .eq('subscriptions.user_id', org.owner_id)
    .eq('subscriptions.org_id', user.org_id)
    .eq('subscriptions.status', 'approved')
    .limit(1)

  if (!items || items.length === 0) {
    return { subscribed: false, error: NextResponse.json({ error: 'Subscription required for this service' }, { status: 403 }) }
  }

  return { subscribed: true }
}

/**
 * Log an activity event to the station_messages table.
 * Fire-and-forget — never throws.
 */
export async function logActivity(supabase, { orgId, userId, userName, content, actionType }) {
  try {
    const { error } = await supabase.from('station_messages').insert({
      org_id: orgId,
      user_id: userId,
      user_name: userName || 'Unknown',
      type: 'activity',
      content,
      action_type: actionType,
    })
    if (error) console.error('logActivity insert failed:', error.message)
  } catch (err) {
    console.error('logActivity exception:', err)
  }
}

export function paginationParams(request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { page, limit, from, to, searchParams }
}
