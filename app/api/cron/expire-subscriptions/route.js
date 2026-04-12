import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date().toISOString()
  const today = now.split('T')[0]

  // 1. Expire approved subscriptions past end_date
  const { data: expiredApproved } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'approved')
    .lt('end_date', today)
    .select('id')

  // 2. Expire pending_payment subscriptions older than 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { data: expiredPending } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'pending_payment')
    .lt('created_at', sevenDaysAgo.toISOString())
    .select('id')

  return NextResponse.json({
    expired_approved: expiredApproved?.length || 0,
    expired_pending: expiredPending?.length || 0,
    date: today,
  })
}
