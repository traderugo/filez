import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rateLimit'

// POST — user changes their own password
export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`changepw:${user.id}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { current_password, new_password } = await request.json()

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    if (new_password.length > 128) {
      return NextResponse.json({ error: 'Password too long' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.password_hash) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(current_password, profile.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const hash = await bcrypt.hash(new_password, 12)

    await supabase
      .from('users')
      .update({ password_hash: hash, must_change_password: false })
      .eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
