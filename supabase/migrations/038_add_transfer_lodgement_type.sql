-- Add 'transfer' to the lodgement_type CHECK constraint on station_banks
ALTER TABLE public.station_banks
  DROP CONSTRAINT IF EXISTS station_banks_lodgement_type_check;

ALTER TABLE public.station_banks
  ADD CONSTRAINT station_banks_lodgement_type_check
    CHECK (lodgement_type IN ('pos', 'transfer', 'bank_deposit', 'cash', 'other'));
