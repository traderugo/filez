import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

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

    // Rate limit: 30 requests per 15 min per admin
    const { success } = rateLimit(`files:${admin.id}`, 30)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { user_id, file_name, share_link, description } = await request.json()

    if (!user_id || !file_name || !share_link) {
      return NextResponse.json({ error: 'user_id, file_name, and share_link are required' }, { status: 400 })
    }

    if (file_name.length > 200 || share_link.length > 2000) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 })
    }

    // Validate share_link starts with https://
    if (!share_link.trim().startsWith('https://')) {
      return NextResponse.json({ error: 'share_link must start with https://' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_files')
      .insert({
        user_id,
        file_name: file_name.trim(),
        share_link: share_link.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to add file' }, { status: 500 })
    }

    return NextResponse.json({ file: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const supabase = await createServerSupabase()
    const admin = await verifyAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 30 requests per 15 min per admin (shared with POST)
    const { success } = rateLimit(`files:${admin.id}`, 30)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }

    const { error } = await supabase.from('user_files').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
