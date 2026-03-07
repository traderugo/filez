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

-- Note: subscription_items FK migration skipped — table created on demand by subscription flow
