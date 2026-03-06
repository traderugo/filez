-- Switch from PIN to password auth
-- Add password_hash, must_change_password flag
-- Keep pin_hash temporarily for backward compat (can drop later)

ALTER TABLE public.users
  ADD COLUMN password_hash text,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
