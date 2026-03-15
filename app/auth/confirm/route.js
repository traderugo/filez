import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Handles ALL Supabase email confirmation/action links.
 * Default Supabase email templates link to:
 *   /auth/confirm?token_hash=...&type=signup|recovery|magiclink|email_change
 *
 * This route verifies the token via verifyOtp() and redirects based on type:
 *   - signup     → /dashboard (or /admin for admins)
 *   - recovery   → /auth/update-password
 *   - magiclink  → /dashboard (or /admin for admins)
 *   - email_change → /dashboard
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') || 'signup'
  let next = searchParams.get('next')

  // Prevent open redirect
  if (next && (!next.startsWith('/') || next.startsWith('//') || next.includes('://'))) {
    next = null
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

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Mark email_verified in public.users for signup/email_change
  if (data.user.email_confirmed_at && (type === 'signup' || type === 'email_change')) {
    await svc
      .from('users')
      .update({ email_verified: true })
      .eq('id', data.user.id)
  }

  // Determine redirect based on type (unless explicit next param)
  if (next) {
    return NextResponse.redirect(new URL(next, request.url))
  }

  // Recovery → update password page
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/update-password', request.url))
  }

  // Signup / magiclink → check role for admin redirect
  const { data: profile } = await svc
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profile?.role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
