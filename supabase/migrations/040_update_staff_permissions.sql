-- Update staff visible_pages: replace old 'dso'/'lube' keys with granular page keys
-- and add report page keys. Existing staff get full access (all pages).

-- Update default for new invites
ALTER TABLE public.org_invites
  ALTER COLUMN visible_pages SET DEFAULT '["daily-sales","product-receipt","lodgements","lube","customer-payments","consumption","report-summary","report-daily-sales","report-audit","report-account-ledger","report-product-received"]';

-- Migrate existing rows that still have the old default
UPDATE public.org_invites
SET visible_pages = '["daily-sales","product-receipt","lodgements","lube","customer-payments","consumption","report-summary","report-daily-sales","report-audit","report-account-ledger","report-product-received"]'::jsonb
WHERE visible_pages = '["dso","lube"]'::jsonb;
