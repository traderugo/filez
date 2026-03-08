import { NextResponse } from 'next/server'
import { authenticateUser, getServiceClient } from '@/lib/entryHelpers'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const supabase = getServiceClient()
    const { data } = await supabase
      .from('station_customers')
      .select('id, name, phone')
      .eq('org_id', user.org_id)
      .order('sort_order')

    return NextResponse.json({ customers: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
