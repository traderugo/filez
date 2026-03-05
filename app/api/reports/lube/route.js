import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user || !user.org_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear()
    const month = parseInt(searchParams.get('month')) || (new Date().getMonth() + 1)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0)
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    const daysInMonth = endDate.getDate()
    const monthDate = startDate // first day of month for stock lookup

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const orgId = user.org_id

    // Fetch products, daily entries, and monthly stock in parallel
    const [productsRes, dailyRes, stockRes] = await Promise.all([
      supabase.from('station_lube_products').select('*').eq('org_id', orgId).order('sort_order'),
      supabase.from('lube_daily').select('*').eq('org_id', orgId).gte('entry_date', startDate).lte('entry_date', endDateStr).order('entry_date'),
      supabase.from('lube_monthly_stock').select('*').eq('org_id', orgId).eq('month', monthDate),
    ])

    const dailyIds = (dailyRes.data || []).map((d) => d.id)

    let transactions = []
    if (dailyIds.length > 0) {
      const txRes = await supabase.from('lube_transactions').select('*').in('daily_id', dailyIds)
      transactions = txRes.data || []
    }

    return NextResponse.json({
      year,
      month,
      daysInMonth,
      products: productsRes.data || [],
      daily: dailyRes.data || [],
      transactions,
      monthlyStock: stockRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
