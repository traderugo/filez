-- Global services table + hardcoded services
-- Admin manages via API (service role key bypasses RLS), so no write policies needed

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Everyone can read services
CREATE POLICY "services_select_all" ON public.services
  FOR SELECT USING (true);

-- Seed the 3 hardcoded services
INSERT INTO public.services (key, name, description, price, is_active) VALUES
  ('fuel-operations', 'Daily Sales Operations', 'Daily sales, product receipt, and lodgements', 0, true),
  ('lube-management', 'Lube Management', 'Lube sales and stock entries', 0, true),
  ('customer-payments', 'Customer Payments', 'Customer sales and payment records', 0, true);

-- Subscription items (which services a user selected)
CREATE TABLE IF NOT EXISTS public.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_items_sub ON public.subscription_items(subscription_id);

ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription items
CREATE POLICY "sub_items_select_own" ON public.subscription_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_items.subscription_id AND s.user_id = auth.uid()
    )
  );

-- Service role handles inserts/deletes (bypasses RLS)
