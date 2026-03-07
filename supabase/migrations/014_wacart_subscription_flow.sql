-- Wacart-style subscription flow
-- New statuses: pending_payment, pending_approval, approved, rejected
-- New columns: reference_code, payment_deadline

-- 1. Drop the old status constraint and add new one
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending_payment', 'pending_approval', 'approved', 'expired', 'rejected'));

-- 2. Migrate existing data to new statuses
UPDATE public.subscriptions SET status = 'pending_payment' WHERE status = 'pending';
UPDATE public.subscriptions SET status = 'approved' WHERE status = 'active';
UPDATE public.subscriptions SET status = 'rejected' WHERE status = 'revoked';

-- 3. Add new columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz;

-- 4. Index on reference_code for lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_reference_code ON public.subscriptions(reference_code);

-- 5. Allow users to update their own subscriptions (for proof upload)
CREATE POLICY "users_update_own_subs" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
