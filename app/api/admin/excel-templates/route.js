import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

async function requireAdmin() {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') return null
  return user
}

// GET — list all templates
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getAdminClient()
    const { data, error } = await db
      .from('excel_templates')
      .select('id, name, description, file_name, file_size, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })

    return NextResponse.json({ templates: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — save template metadata after file is uploaded to storage
export async function POST(request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description, file_path, file_name, file_size } = await request.json()

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!file_path) return NextResponse.json({ error: 'file_path is required' }, { status: 400 })
    if (!file_name) return NextResponse.json({ error: 'file_name is required' }, { status: 400 })

    const db = getAdminClient()
    const { data, error } = await db
      .from('excel_templates')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        file_path,
        file_name,
        file_size: file_size || 0,
        created_by: admin.id,
      })
      .select('id, name, description, file_name, file_size, created_at')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })

    return NextResponse.json({ template: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove template record + storage file
export async function DELETE(request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = getAdminClient()

    // Fetch the record first to get the file path
    const { data: template, error: fetchErr } = await db
      .from('excel_templates')
      .select('file_path')
      .eq('id', id)
      .single()

    if (fetchErr || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Delete from storage
    await db.storage.from('excel-templates').remove([template.file_path])

    // Delete the record
    const { error: delErr } = await db
      .from('excel_templates')
      .delete()
      .eq('id', id)

    if (delErr) return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update name/description only
export async function PATCH(request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, name, description } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const db = getAdminClient()
    const { data, error } = await db
      .from('excel_templates')
      .update({ name: name.trim(), description: description?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, description, file_name, file_size, created_at')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })

    return NextResponse.json({ template: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
