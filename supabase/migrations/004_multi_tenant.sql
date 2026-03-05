-- Multi-tenant: Organizations, Custom Fields, Services
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. Create organizations table FIRST (users.org_id depends on it)
-- ============================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Anyone can read orgs (needed for invite page)
CREATE POLICY "org_public_select" ON public.organizations
  FOR SELECT USING (true);

CREATE POLICY "org_owner_update" ON public.organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "org_owner_insert" ON public.organizations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 2. Add org_id to users BEFORE any policies reference it
-- ============================================================
ALTER TABLE public.users ADD COLUMN org_id uuid REFERENCES public.organizations(id);
CREATE INDEX idx_users_org_id ON public.users(org_id);

-- ============================================================
-- 3. Custom fields defined by org admin
-- ============================================================
CREATE TABLE public.org_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'select')),
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fields_public_select" ON public.org_custom_fields
  FOR SELECT USING (true);

CREATE POLICY "fields_owner_insert" ON public.org_custom_fields
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

CREATE POLICY "fields_owner_update" ON public.org_custom_fields
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

CREATE POLICY "fields_owner_delete" ON public.org_custom_fields
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

-- ============================================================
-- 4. User responses to custom fields
-- ============================================================
CREATE TABLE public.user_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.org_custom_fields(id) ON DELETE CASCADE,
  value text,
  UNIQUE(user_id, field_id)
);

ALTER TABLE public.user_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_values_select_own" ON public.user_field_values
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "field_values_admin_select" ON public.user_field_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.organizations o ON o.id = u.org_id
      WHERE u.id = user_field_values.user_id
        AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "field_values_insert_own" ON public.user_field_values
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. Services/packages offered by org
-- ============================================================
CREATE TABLE public.org_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_public_select" ON public.org_services
  FOR SELECT USING (true);

CREATE POLICY "services_owner_insert" ON public.org_services
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

CREATE POLICY "services_owner_update" ON public.org_services
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

CREATE POLICY "services_owner_delete" ON public.org_services
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

-- ============================================================
-- 6. Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = check_org_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.organizations WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 7. Replace old blanket admin RLS with org-scoped policies
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "admins_select_all_users" ON public.users;
DROP POLICY IF EXISTS "admins_select_all_subs" ON public.subscriptions;
DROP POLICY IF EXISTS "admins_update_all_subs" ON public.subscriptions;
DROP POLICY IF EXISTS "admins_select_all_files" ON public.user_files;
DROP POLICY IF EXISTS "admins_insert_files" ON public.user_files;
DROP POLICY IF EXISTS "admins_update_files" ON public.user_files;
DROP POLICY IF EXISTS "admins_delete_files" ON public.user_files;
DROP POLICY IF EXISTS "admins_select_all_feedback" ON public.feedback;

-- Admins see users in their org
CREATE POLICY "admins_select_org_users" ON public.users
  FOR SELECT USING (
    public.is_admin() AND org_id = public.admin_org_id()
  );

-- Admins see subscriptions for their org's users
CREATE POLICY "admins_select_org_subs" ON public.subscriptions
  FOR SELECT USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = subscriptions.user_id AND u.org_id = public.admin_org_id()
    )
  );

CREATE POLICY "admins_update_org_subs" ON public.subscriptions
  FOR UPDATE USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = subscriptions.user_id AND u.org_id = public.admin_org_id()
    )
  );

-- Admins manage files for their org's users
CREATE POLICY "admins_select_org_files" ON public.user_files
  FOR SELECT USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_files.user_id AND u.org_id = public.admin_org_id()
    )
  );

CREATE POLICY "admins_insert_org_files" ON public.user_files
  FOR INSERT WITH CHECK (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_files.user_id AND u.org_id = public.admin_org_id()
    )
  );

CREATE POLICY "admins_update_org_files" ON public.user_files
  FOR UPDATE USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_files.user_id AND u.org_id = public.admin_org_id()
    )
  );

CREATE POLICY "admins_delete_org_files" ON public.user_files
  FOR DELETE USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_files.user_id AND u.org_id = public.admin_org_id()
    )
  );

-- Admins see feedback from their org's users
CREATE POLICY "admins_select_org_feedback" ON public.feedback
  FOR SELECT USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = feedback.user_id AND u.org_id = public.admin_org_id()
    )
  );
