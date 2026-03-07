-- DROP everything created by migrations 015, 016, 017
-- Run this FIRST in Supabase SQL Editor, then run the fixed migrations

-- ============================================
-- Drop 017 objects (hardcoded services additions)
-- ============================================
ALTER TABLE public.services DROP COLUMN IF EXISTS key;

-- ============================================
-- Drop 016 objects (entries tables)
-- ============================================
DROP TABLE IF EXISTS customer_payment_entries CASCADE;
DROP TABLE IF EXISTS lube_stock_entries CASCADE;
DROP TABLE IF EXISTS lube_sales_entries CASCADE;
DROP TABLE IF EXISTS lodgement_entries CASCADE;
DROP TABLE IF EXISTS product_receipt_entries CASCADE;
DROP TABLE IF EXISTS daily_sales_entries CASCADE;

-- ============================================
-- Drop 015 objects (subscription_items + global services)
-- ============================================
DROP TABLE IF EXISTS public.subscription_items CASCADE;
DROP POLICY IF EXISTS "services_select_all" ON public.services;
DROP POLICY IF EXISTS "services_admin_insert" ON public.services;
DROP POLICY IF EXISTS "services_admin_update" ON public.services;
DROP POLICY IF EXISTS "services_admin_delete" ON public.services;
DROP TABLE IF EXISTS public.services CASCADE;

