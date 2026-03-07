import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

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

export function paginationParams(request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { page, limit, from, to, searchParams }
}
