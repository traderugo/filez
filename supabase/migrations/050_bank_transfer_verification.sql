-- Bank transfer auto-verification columns
-- Same pattern as WaCart: suffix makes amount unique, Gmail checker auto-matches

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS verification_suffix smallint,
  ADD COLUMN IF NOT EXISTS verification_confidence decimal(3,2),
  ADD COLUMN IF NOT EXISTS verified_by varchar(20);

COMMENT ON COLUMN public.subscriptions.verification_suffix IS 'Unique 1-99 suffix added to total_amount for bank transfer verification';
COMMENT ON COLUMN public.subscriptions.verification_confidence IS 'Auto-verify confidence score 0.00-1.00';
COMMENT ON COLUMN public.subscriptions.verified_by IS 'automatic or manual';
