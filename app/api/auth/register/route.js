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

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { success } = rateLimit(`register:${ip}`, 5)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const supabaseAdmin = getAdminClient()
    const { name, email, phone, password, org_id } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }

    if (name.trim().length < 1) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }

    if (name.length > 100 || email.length > 254) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password too long' }, { status: 400 })
    }

    if (phone && !/^\+?\d{7,15}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 })
    }

    if (org_id) {
      const { data: orgCheck } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', org_id)
        .single()
      if (!orgCheck) {
        return NextResponse.json({ error: 'Station not found' }, { status: 400 })
      }
    }

    // Check if email already registered
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      if (org_id) {
        await supabaseAdmin
          .from('users')
          .update({ org_id })
          .eq('id', existing.id)
      }
      return NextResponse.json({ ok: true, existing: true })
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
          const hash = await bcrypt.hash(password, 12)
          await supabaseAdmin.from('users').upsert({
            id: existingAuth.id,
            email: email.toLowerCase(),
            name: name.trim(),
            phone: phone?.trim() || null,
            password_hash: hash,
            ...(org_id ? { org_id } : {}),
          })
          return NextResponse.json({ ok: true })
        }
      }
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    const hash = await bcrypt.hash(password, 12)

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email: email.toLowerCase(),
      name: name.trim(),
      phone: phone?.trim() || null,
      password_hash: hash,
      ...(org_id ? { org_id } : {}),
    })

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
