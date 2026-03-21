-- Drop the consumption_entries table.
-- All consumption data now comes from daily_sales_entries.nozzle_readings JSONB
-- (consumption, pour_back, consumption_customer_id fields per nozzle).

DROP TABLE IF EXISTS public.consumption_entries;

-- Remove 'consumption' from default visible_pages for new invites
ALTER TABLE public.org_invites
  ALTER COLUMN visible_pages SET DEFAULT '["daily-sales","product-receipt","lodgements","lube","customer-payments","report-summary","report-daily-sales","report-audit","report-account-ledger","report-product-received"]';

-- Strip 'consumption' from existing rows
UPDATE public.org_invites
SET visible_pages = visible_pages - 'consumption'
WHERE visible_pages ? 'consumption';

