import { cookies } from 'next/headers'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifySessionToken, COOKIE_NAME } from './pinSession'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// For server components (React.cache deduplicates per request)
export const getPinUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const userId = await verifySessionToken(token)
  if (!userId) return null

  const supabase = getServiceClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, email, name, phone, role, org_id')
    .eq('id', userId)
    .single()

  return profile || null
})

// For API route handlers (reads cookie from request headers)
export async function getPinUserFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match) return null

  const token = decodeURIComponent(match[1])
  const userId = await verifySessionToken(token)
  if (!userId) return null

  const supabase = getServiceClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, email, name, phone, role, org_id')
    .eq('id', userId)
    .single()

  return profile || null
}
