import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rateLimit'

// POST — manager resets a staff member's password
export async function POST(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`reset:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { staff_email } = await request.json()
    if (!staff_email) {
      return NextResponse.json({ error: 'Staff email required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Find staff user
    const { data: staff } = await supabase
      .from('users')
      .select('id, email, org_id')
      .eq('email', staff_email.toLowerCase())
      .single()

    if (!staff || !staff.org_id) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // Verify the manager owns the station this staff belongs to
    const { data: station } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', staff.org_id)
      .eq('owner_id', user.id)
      .single()

    if (!station) {
      return NextResponse.json({ error: 'You can only reset passwords for your own staff' }, { status: 403 })
    }

    const tempPassword = randomBytes(6).toString('base64url').slice(0, 10)
    const hash = await bcrypt.hash(tempPassword, 12)

    await supabase
      .from('users')
      .update({ password_hash: hash, must_change_password: true })
      .eq('id', staff.id)

    return NextResponse.json({ ok: true, tempPassword })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
