import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { randomInt, createHash } from 'crypto'
import { rateLimit } from '@/lib/rateLimit'

function generatePin() {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

function hashPin(pin) {
  return createHash('sha256').update(pin).digest('hex')
}

async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user : null
}

export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`reset-pin:${admin.id}`, 30)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const pin = generatePin()
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await serviceClient
      .from('users')
      .update({ pin_hash: hashPin(pin) })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: 'Failed to reset PIN' }, { status: 500 })
    }

    return NextResponse.json({ pin })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
