import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request) {
  try {
    // Rate limit: 5 requests per 15 min per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { success } = rateLimit(`register:${ip}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const supabaseAdmin = getAdminClient()
    const { name, email, phone } = await request.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    if (name.trim().length < 1) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }

    if (name.length > 100 || email.length > 254) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 })
    }

    // Validate phone format if provided (7-15 digits)
    if (phone && !/^\+?\d{7,15}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 })
    }

    // Check if email already registered in profiles
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      // Return generic success to prevent email enumeration
      return NextResponse.json({ ok: true })
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: false,
      user_metadata: { name: name.trim(), phone: phone?.trim() || null },
    })

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existingAuth = users?.find(u => u.email === email.toLowerCase())
        if (existingAuth) {
          await supabaseAdmin.from('users').upsert({
            id: existingAuth.id,
            email: email.toLowerCase(),
            name: name.trim(),
            phone: phone?.trim() || null,
          })
          return NextResponse.json({ ok: true })
        }
      }
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email: email.toLowerCase(),
      name: name.trim(),
      phone: phone?.trim() || null,
    })

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
