import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

// GET /api/excel-templates?name=AUDIT REPORT TEMPLATE
// Returns signed URL for a template by name. Any authenticated user can access.
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const db = getAdminClient()

    const { data: template } = await db
      .from('excel_templates')
      .select('file_path, file_name')
      .eq('name', name)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!template) return NextResponse.json({ url: null })

    const { data: signed, error } = await db.storage
      .from('excel-templates')
      .createSignedUrl(template.file_path, 300) // 5 min expiry

    if (error) return NextResponse.json({ url: null })

    return NextResponse.json({ url: signed.signedUrl })
  } catch {
    return NextResponse.json({ url: null })
  }
}
