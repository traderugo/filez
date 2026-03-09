import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

// POST — user changes their own password via Supabase Auth
export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`changepw:${user.id}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { new_password } = await request.json()

    if (!new_password) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    if (new_password.length > 128) {
      return NextResponse.json({ error: 'Password too long' }, { status: 400 })
    }

    const { error } = await supabase.auth.updateUser({ password: new_password })

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update password' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
