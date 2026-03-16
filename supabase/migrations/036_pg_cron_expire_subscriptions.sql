-- Replace Vercel cron with pg_cron for expiring subscriptions.
-- Runs daily at 03:00 UTC entirely inside Postgres — no serverless function needed.

-- Enable pg_cron extension (already available on all Supabase plans)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing schedule with this name before creating
SELECT cron.unschedule('expire-subscriptions') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-subscriptions'
);

SELECT cron.schedule(
  'expire-subscriptions',
  '0 3 * * *',
  $$
    -- Expire approved subscriptions whose end_date has passed
    UPDATE public.subscriptions
    SET status = 'expired'
    WHERE status = 'approved'
      AND end_date < CURRENT_DATE;

    -- Expire pending_payment subscriptions whose payment_deadline has passed
    UPDATE public.subscriptions
    SET status = 'expired'
    WHERE status = 'pending_payment'
      AND payment_deadline < NOW();
  $$
);
