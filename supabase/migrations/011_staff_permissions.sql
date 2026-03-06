-- Per-staff page visibility: manager controls which pages each staff can see

ALTER TABLE public.org_invites
  ADD COLUMN visible_pages jsonb NOT NULL DEFAULT '["dso","lube"]';
