import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt, createHash } from 'crypto'
import { rateLimit } from '@/lib/rateLimit'

function generatePin() {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

function hashPin(pin) {
  return createHash('sha256').update(pin).digest('hex')
}

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
    const { name, email, phone, org_id, field_values } = await request.json()

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

    // If org_id provided, validate it exists
    if (org_id) {
      const { data: orgCheck } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', org_id)
        .single()
      if (!orgCheck) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
      }

      // Validate required custom fields
      if (field_values && Array.isArray(field_values)) {
        const { data: requiredFields } = await supabaseAdmin
          .from('org_custom_fields')
          .select('id, field_name')
          .eq('org_id', org_id)
          .eq('required', true)

        for (const rf of (requiredFields || [])) {
          const val = field_values.find((fv) => fv.field_id === rf.id)
          if (!val || !val.value?.trim()) {
            return NextResponse.json({ error: `"${rf.field_name}" is required` }, { status: 400 })
          }
        }
      }
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
            ...(org_id ? { org_id } : {}),
          })
          return NextResponse.json({ ok: true })
        }
      }
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    const pin = generatePin()

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email: email.toLowerCase(),
      name: name.trim(),
      phone: phone?.trim() || null,
      pin_hash: hashPin(pin),
      ...(org_id ? { org_id } : {}),
    })

    if (profileError) {
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    // Save custom field values if provided
    if (org_id && field_values && Array.isArray(field_values) && field_values.length > 0) {
      const rows = field_values
        .filter((fv) => fv.field_id && fv.value?.trim())
        .map((fv) => ({
          user_id: authUser.user.id,
          field_id: fv.field_id,
          value: fv.value.trim(),
        }))

      if (rows.length > 0) {
        await supabaseAdmin.from('user_field_values').insert(rows)
      }
    }

    return NextResponse.json({ ok: true, pin })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
