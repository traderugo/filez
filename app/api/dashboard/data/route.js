import { NextResponse } from 'next/server'
import { getPinUserFromRequest } from '@/lib/pinAuth'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const user = await getPinUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const [subRes, filesRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id, status, start_date, end_date, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('user_files')
        .select('id, file_name, share_link, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    let customData = []
    let services = []
    let orgPlanType = 'recurring'

    if (user.org_id) {
      const [fvRes, fieldsRes, svcRes, orgRes] = await Promise.all([
        supabase.from('user_field_values').select('field_id, value').eq('user_id', user.id),
        supabase.from('org_custom_fields').select('id, field_name').eq('org_id', user.org_id).order('sort_order'),
        supabase.from('org_services').select('id, name, description, price').eq('org_id', user.org_id).order('sort_order'),
        supabase.from('organizations').select('plan_type').eq('id', user.org_id).single(),
      ])

      const values = fvRes.data || []
      customData = (fieldsRes.data || []).map((f) => ({
        label: f.field_name,
        value: values.find((v) => v.field_id === f.id)?.value || '-',
      }))
      services = svcRes.data || []
      orgPlanType = orgRes.data?.plan_type || 'recurring'
    }

    return NextResponse.json({
      profile: user,
      subscription: subRes.data?.[0] || null,
      files: filesRes.data || [],
      customData,
      services,
      orgPlanType,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
