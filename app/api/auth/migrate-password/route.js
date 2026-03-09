import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rateLimit'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Migrate a legacy user's password from bcrypt (public.users.password_hash)
 * into Supabase Auth. Called when signInWithPassword() fails for an existing user.
 *
 * Steps:
 * 1. Look up user by email in public.users
 * 2. Verify password against bcrypt hash
 * 3. Set password + auto-confirm email in auth.users via admin API
 * 4. Return success so the client can retry signInWithPassword()
 */
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { success } = rateLimit(`migrate:${ip}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Find user with a legacy password_hash
    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify against the bcrypt hash
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Set the password in Supabase Auth + auto-confirm email so they can sign in
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    })

    if (updateError) {
      return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
    }

    return NextResponse.json({ migrated: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
