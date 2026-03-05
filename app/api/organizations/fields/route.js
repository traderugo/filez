import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

async function getAdminOrg(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', profile.id)
    .single()

  return org ? { adminId: profile.id, orgId: org.id } : null
}

export async function GET(request) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    if (!orgId) {
      return NextResponse.json({ error: 'org_id required' }, { status: 400 })
    }

    const { data: fields } = await supabase
      .from('org_custom_fields')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order')

    return NextResponse.json({ fields: fields || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const ctx = await getAdminOrg(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success } = rateLimit(`fields:${ctx.adminId}`, 30)
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const { field_name, field_type, options, required } = await request.json()

    if (!field_name || field_name.trim().length < 1 || field_name.length > 100) {
      return NextResponse.json({ error: 'Field name required (max 100 chars)' }, { status: 400 })
    }

    const validTypes = ['text', 'number', 'select']
    if (field_type && !validTypes.includes(field_type)) {
      return NextResponse.json({ error: 'Invalid field type' }, { status: 400 })
    }

    if (field_type === 'select' && (!Array.isArray(options) || options.length < 1)) {
      return NextResponse.json({ error: 'Select fields require options array' }, { status: 400 })
    }

    // Get next sort_order
    const { data: last } = await supabase
      .from('org_custom_fields')
      .select('sort_order')
      .eq('org_id', ctx.orgId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const { data: field, error } = await supabase
      .from('org_custom_fields')
      .insert({
        org_id: ctx.orgId,
        field_name: field_name.trim(),
        field_type: field_type || 'text',
        options: field_type === 'select' ? options : null,
        required: required || false,
        sort_order: (last?.sort_order ?? -1) + 1,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to create field' }, { status: 500 })
    return NextResponse.json({ field })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const supabase = await createServerSupabase()
    const ctx = await getAdminOrg(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, field_name, field_type, options, required, sort_order } = await request.json()
    if (!id) return NextResponse.json({ error: 'Field id required' }, { status: 400 })

    const updates = {}
    if (field_name !== undefined) {
      if (field_name.trim().length < 1 || field_name.length > 100) {
        return NextResponse.json({ error: 'Field name required (max 100 chars)' }, { status: 400 })
      }
      updates.field_name = field_name.trim()
    }
    if (field_type !== undefined) updates.field_type = field_type
    if (options !== undefined) updates.options = options
    if (required !== undefined) updates.required = required
    if (sort_order !== undefined) updates.sort_order = sort_order

    const { data: field, error } = await supabase
      .from('org_custom_fields')
      .update(updates)
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update field' }, { status: 500 })
    return NextResponse.json({ field })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const supabase = await createServerSupabase()
    const ctx = await getAdminOrg(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Field id required' }, { status: 400 })

    const { error } = await supabase
      .from('org_custom_fields')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.orgId)

    if (error) return NextResponse.json({ error: 'Failed to delete field' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
