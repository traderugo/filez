-- Add missing columns to subscriptions table (from migration 005 which was never run)
-- Run in Supabase SQL Editor

-- Add plan_type and total_amount to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_type text CHECK (plan_type IN ('one_time', 'recurring')),
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2);
