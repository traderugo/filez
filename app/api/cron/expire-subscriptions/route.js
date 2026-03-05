import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('end_date', today)
    .select('id')

  if (error) {
    return NextResponse.json({ error: 'Failed to expire subscriptions' }, { status: 500 })
  }

  return NextResponse.json({ expired: data?.length || 0, date: today })
}
