import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { rateLimit } from '@/lib/rateLimit'
import { createSessionToken, getSessionCookieOptions, COOKIE_NAME } from '@/lib/pinSession'

function hashPin(pin) {
  return createHash('sha256').update(pin).digest('hex')
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { success } = rateLimit(`pin-login:${ip}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
    }

    const { email, pin } = await request.json()

    if (!email || !pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'Invalid email or PIN' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, role, org_id, pin_hash')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!user || !user.pin_hash) {
      return NextResponse.json({ error: 'Invalid email or PIN' }, { status: 401 })
    }

    if (hashPin(pin) !== user.pin_hash) {
      return NextResponse.json({ error: 'Invalid email or PIN' }, { status: 401 })
    }

    const token = await createSessionToken(user.id)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(COOKIE_NAME, token, getSessionCookieOptions())
    return response
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
