import { cache } from 'react'
import { createServerSupabase } from './supabaseServer'

export const getServerUser = cache(async () => {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, name, phone, role, org_id')
    .eq('id', user.id)
    .single()

  return profile
})

export const getServerUserOrRedirect = async () => {
  const user = await getServerUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/auth/login')
  }
  return user
}

export const getServerAdminOrRedirect = async () => {
  const user = await getServerUser()
  if (!user || user.role !== 'admin') {
    const { redirect } = await import('next/navigation')
    redirect('/')
  }
  return user
}
