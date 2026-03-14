/**
 * Chat & Activity Log API
 *
 * Required Supabase migration:
 *
 *   CREATE TABLE station_messages (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 *     user_id      UUID REFERENCES users(id),
 *     user_name    TEXT,
 *     type         TEXT NOT NULL DEFAULT 'message',   -- 'message' | 'activity'
 *     content      TEXT,                              -- nullable (null = deleted)
 *     action_type  TEXT,                              -- e.g. 'created_entry', 'left_station'
 *     deleted_at   TIMESTAMPTZ,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   CREATE INDEX idx_station_messages_org_created
 *     ON station_messages (org_id, created_at DESC);
 *
 *   -- RLS: allow station members to read/insert their org's messages
 *   ALTER TABLE station_messages ENABLE ROW LEVEL SECURITY;
 *
 *   -- If upgrading existing table:
 *   ALTER TABLE station_messages ALTER COLUMN content DROP NOT NULL;
 *   ALTER TABLE station_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
 */

import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient } from '@/lib/entryHelpers'

// GET /api/chat?org_id=...&since=<ISO timestamp>
export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    const supabase = getServiceClient()
    let query = supabase
      .from('station_messages')
      .select('*')
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: true })
      .limit(300)

    if (since) query = query.gt('created_at', since)

    const { data, error: dbError } = await query
    if (dbError) return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })

    return NextResponse.json({ messages: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/chat?org_id=...  — send a chat message
export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from('station_messages')
      .insert({
        org_id: user.org_id,
        user_id: user.id,
        user_name: user.name || user.email,
        type: 'message',
        content: content.trim(),
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })

    return NextResponse.json({ message: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE /api/chat?id=<message_id> — soft-delete own message
export async function DELETE(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getServiceClient()
    const { error: dbError } = await supabase
      .from('station_messages')
      .update({ content: null, deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('org_id', user.org_id)

    if (dbError) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
