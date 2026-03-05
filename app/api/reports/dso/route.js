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
    const endDate = new Date(year, month, 0) // last day of month
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    const daysInMonth = endDate.getDate()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const orgId = user.org_id

    // Fetch station config + daily entries in parallel
    const [pumpsRes, tanksRes, banksRes, consumptionCatsRes, dailyRes] = await Promise.all([
      supabase.from('station_pumps').select('*').eq('org_id', orgId).order('fuel_type, sort_order'),
      supabase.from('station_tanks').select('*').eq('org_id', orgId).order('fuel_type, sort_order'),
      supabase.from('station_banks').select('*').eq('org_id', orgId).order('sort_order'),
      supabase.from('station_consumption_categories').select('*').eq('org_id', orgId).order('fuel_type, sort_order'),
      supabase.from('dso_daily').select('*').eq('org_id', orgId).gte('entry_date', startDate).lte('entry_date', endDateStr).order('entry_date'),
    ])

    const dailyIds = (dailyRes.data || []).map((d) => d.id)

    // Fetch all child records for the month
    let pumpReadings = []
    let tankReadings = []
    let consumption = []
    let pos = []

    if (dailyIds.length > 0) {
      const [prRes, trRes, conRes, posRes] = await Promise.all([
        supabase.from('dso_pump_readings').select('*').in('daily_id', dailyIds),
        supabase.from('dso_tank_readings').select('*').in('daily_id', dailyIds),
        supabase.from('dso_consumption').select('*').in('daily_id', dailyIds),
        supabase.from('dso_pos').select('*').in('daily_id', dailyIds),
      ])
      pumpReadings = prRes.data || []
      tankReadings = trRes.data || []
      consumption = conRes.data || []
      pos = posRes.data || []
    }

    return NextResponse.json({
      year,
      month,
      daysInMonth,
      config: {
        pumps: pumpsRes.data || [],
        tanks: tanksRes.data || [],
        banks: banksRes.data || [],
        consumptionCategories: consumptionCatsRes.data || [],
      },
      daily: dailyRes.data || [],
      pumpReadings,
      tankReadings,
      consumption,
      pos,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
