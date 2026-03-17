-- Add 'transfer' to the lodgement_type CHECK constraint on lodgement_entries
ALTER TABLE public.lodgement_entries
  DROP CONSTRAINT IF EXISTS lodgement_entries_lodgement_type_check;

ALTER TABLE public.lodgement_entries
  ADD CONSTRAINT lodgement_entries_lodgement_type_check
    CHECK (lodgement_type IN ('deposit', 'lube-deposit', 'pos', 'transfer'));
