-- Global services table (admin-managed, replaces per-org org_services for subscribe flow)

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Everyone can read active services
CREATE POLICY "services_select_all" ON public.services
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "services_admin_insert" ON public.services
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "services_admin_update" ON public.services
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "services_admin_delete" ON public.services
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Update subscription_items to reference global services instead of org_services
-- (subscription_items.service_id currently references org_services, we need to drop that FK)
ALTER TABLE public.subscription_items
  DROP CONSTRAINT IF EXISTS subscription_items_service_id_fkey;

-- Add new FK to global services (optional, skip if you want flexibility)
-- ALTER TABLE public.subscription_items
--   ADD CONSTRAINT subscription_items_service_id_fkey
--   FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
