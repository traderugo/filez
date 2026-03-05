-- Add PIN hash column for email + PIN authentication
-- Run in Supabase SQL Editor

ALTER TABLE public.users ADD COLUMN pin_hash text;
