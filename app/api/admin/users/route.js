import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

export async function GET() {
  const authUser = await getAuthUser()
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, email_verified, created_at, org_id')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  return NextResponse.json(data)
}
