-- Add months column to subscriptions for multi-month billing
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS months integer NOT NULL DEFAULT 1;
