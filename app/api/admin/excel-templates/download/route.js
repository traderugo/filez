import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

// GET /api/admin/excel-templates/download?id=<uuid>
// Returns a short-lived signed URL for downloading the file
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = getAdminClient()

    const { data: template } = await db
      .from('excel_templates')
      .select('file_path, file_name')
      .eq('id', id)
      .single()

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const { data: signed, error } = await db.storage
      .from('excel-templates')
      .createSignedUrl(template.file_path, 60) // 60 second expiry

    if (error) return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 })

    return NextResponse.json({ url: signed.signedUrl, file_name: template.file_name })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
