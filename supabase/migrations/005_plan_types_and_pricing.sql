-- Plan types (one-time vs recurring) and service pricing
-- Run in Supabase SQL Editor

-- 1. Add plan_type to organizations
ALTER TABLE public.organizations
  ADD COLUMN plan_type text NOT NULL DEFAULT 'recurring'
  CHECK (plan_type IN ('one_time', 'recurring'));

-- 2. Add price to org_services
ALTER TABLE public.org_services
  ADD COLUMN price numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Add plan_type and total_amount to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN plan_type text CHECK (plan_type IN ('one_time', 'recurring')),
  ADD COLUMN total_amount numeric(12,2);

-- 4. Subscription items — which services a user selected
CREATE TABLE public.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.org_services(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_items_sub ON public.subscription_items(subscription_id);

-- Users can read their own subscription items
CREATE POLICY "sub_items_select_own" ON public.subscription_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_items.subscription_id AND s.user_id = auth.uid()
    )
  );

-- Users can insert items for their own subscriptions
CREATE POLICY "sub_items_insert_own" ON public.subscription_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_items.subscription_id AND s.user_id = auth.uid()
    )
  );

-- Admins can read subscription items for their org's users
CREATE POLICY "sub_items_admin_select" ON public.subscription_items
  FOR SELECT USING (
    public.is_admin() AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.users u ON u.id = s.user_id
      WHERE s.id = subscription_items.subscription_id
        AND u.org_id = public.admin_org_id()
    )
  );
