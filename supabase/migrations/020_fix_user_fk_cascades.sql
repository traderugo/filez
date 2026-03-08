-- Fix foreign keys that block user deletion
-- created_by → SET NULL (preserve entries, clear attribution)
-- organizations.owner_id → CASCADE (delete owner = delete org + all data)

-- 1. organizations.owner_id
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_owner_id_fkey,
  ADD CONSTRAINT organizations_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. daily_sales_entries.created_by
ALTER TABLE public.daily_sales_entries
  DROP CONSTRAINT IF EXISTS daily_sales_entries_created_by_fkey,
  ADD CONSTRAINT daily_sales_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. product_receipt_entries.created_by
ALTER TABLE public.product_receipt_entries
  DROP CONSTRAINT IF EXISTS product_receipt_entries_created_by_fkey,
  ADD CONSTRAINT product_receipt_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. lodgement_entries.created_by
ALTER TABLE public.lodgement_entries
  DROP CONSTRAINT IF EXISTS lodgement_entries_created_by_fkey,
  ADD CONSTRAINT lodgement_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 5. lube_sales_entries.created_by
ALTER TABLE public.lube_sales_entries
  DROP CONSTRAINT IF EXISTS lube_sales_entries_created_by_fkey,
  ADD CONSTRAINT lube_sales_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 6. lube_stock_entries.created_by
ALTER TABLE public.lube_stock_entries
  DROP CONSTRAINT IF EXISTS lube_stock_entries_created_by_fkey,
  ADD CONSTRAINT lube_stock_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 7. customer_payment_entries.created_by
ALTER TABLE public.customer_payment_entries
  DROP CONSTRAINT IF EXISTS customer_payment_entries_created_by_fkey,
  ADD CONSTRAINT customer_payment_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- dso_daily and lube_daily removed — tables don't exist in production

-- Make created_by nullable where it isn't already
ALTER TABLE public.daily_sales_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.product_receipt_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.lodgement_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.lube_sales_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.lube_stock_entries ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.customer_payment_entries ALTER COLUMN created_by DROP NOT NULL;
