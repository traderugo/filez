import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rateLimit'
import { createSessionToken, getSessionCookieOptions, COOKIE_NAME } from '@/lib/pinSession'

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { success } = rateLimit(`login:${ip}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, role, org_id, password_hash, must_change_password')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await createSessionToken(user.id)
    const response = NextResponse.json({
      ok: true,
      must_change_password: user.must_change_password,
    })
    response.cookies.set(COOKIE_NAME, token, getSessionCookieOptions())
    return response
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
