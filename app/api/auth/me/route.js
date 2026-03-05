import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createServerSupabase } from '@/lib/supabaseServer'

export async function GET(request) {
  try {
    // Try PIN session first (regular users)
    const pinUser = await getPinUserFromRequest(request)
    if (pinUser) {
      return NextResponse.json({ user: { id: pinUser.id, name: pinUser.name, role: pinUser.role } })
    }

    // Fall back to Supabase session (admins)
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('name, role')
        .eq('id', user.id)
        .single()
      return NextResponse.json({ user: { id: user.id, name: profile?.name, role: profile?.role } })
    }

    return NextResponse.json({ user: null })
  } catch {
    return NextResponse.json({ user: null })
  }
}
