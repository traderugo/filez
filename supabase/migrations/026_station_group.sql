-- Add group column to organizations for grouping stations together
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS station_group text;
