-- Fix circular RLS: admin policies on `users` table query `users` to check role,
-- causing silent failure. Use a SECURITY DEFINER function to bypass RLS for the check.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Fix users table
DROP POLICY IF EXISTS "admins_select_all_users" ON public.users;
CREATE POLICY "admins_select_all_users" ON public.users
  FOR SELECT USING (public.is_admin());

-- Fix subscriptions table
DROP POLICY IF EXISTS "admins_select_all_subs" ON public.subscriptions;
CREATE POLICY "admins_select_all_subs" ON public.subscriptions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_all_subs" ON public.subscriptions;
CREATE POLICY "admins_update_all_subs" ON public.subscriptions
  FOR UPDATE USING (public.is_admin());

-- Fix user_files table
DROP POLICY IF EXISTS "admins_select_all_files" ON public.user_files;
CREATE POLICY "admins_select_all_files" ON public.user_files
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_insert_files" ON public.user_files;
CREATE POLICY "admins_insert_files" ON public.user_files
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_update_files" ON public.user_files;
CREATE POLICY "admins_update_files" ON public.user_files
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_files" ON public.user_files;
CREATE POLICY "admins_delete_files" ON public.user_files
  FOR DELETE USING (public.is_admin());

-- Fix feedback table
DROP POLICY IF EXISTS "admins_select_all_feedback" ON public.feedback;
CREATE POLICY "admins_select_all_feedback" ON public.feedback
  FOR SELECT USING (public.is_admin());

-- Fix storage
DROP POLICY IF EXISTS "admins_proofs_select" ON storage.objects;
CREATE POLICY "admins_proofs_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'subscription-proofs' AND public.is_admin()
  );
