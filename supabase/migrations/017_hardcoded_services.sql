-- Hardcoded services: 3 fixed service groups tied to entry types
-- Run in Supabase SQL Editor

-- 1. Add key column to services (unique identifier for hardcoded services)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS key text UNIQUE;

-- 2. Clear existing services and seed the 3 hardcoded ones
DELETE FROM public.services;

INSERT INTO public.services (key, name, description, price, is_active) VALUES
  ('fuel-operations', 'Fuel Operations', 'Daily sales, product receipt, and lodgements', 0, true),
  ('lube-management', 'Lube Management', 'Lube sales and stock entries', 0, true),
  ('customer-payments', 'Customer Payments', 'Customer sales and payment records', 0, true);

-- 3. Prevent admin from inserting/deleting (only update price + is_active)
DROP POLICY IF EXISTS "services_admin_insert" ON public.services;
DROP POLICY IF EXISTS "services_admin_delete" ON public.services;
