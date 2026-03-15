import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Handles Supabase email confirmation links.
 * Default Supabase email templates link to /auth/confirm?token_hash=...&type=signup
 * This route verifies the token and redirects the user.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') || 'signup'
  let next = searchParams.get('next') || '/dashboard'

  // Prevent open redirect
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) {
    next = '/dashboard'
  }

  if (!token_hash) {
    return NextResponse.redirect(new URL('/auth/login?error=missing_token', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  })

  if (error || !data?.user) {
    return NextResponse.redirect(new URL('/auth/login?error=verification_failed', request.url))
  }

  // Mark email_verified in public.users
  if (data.user.email_confirmed_at) {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    await svc
      .from('users')
      .update({ email_verified: true })
      .eq('id', data.user.id)
  }

  // Redirect admins to /admin
  if (next === '/dashboard') {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: profile } = await svc
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()
    if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
