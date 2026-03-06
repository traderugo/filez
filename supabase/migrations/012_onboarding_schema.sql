-- Onboarding schema updates for station setup wizard

-- 1. Add location and onboarding_complete flag to organizations
ALTER TABLE public.organizations
  ADD COLUMN location text,
  ADD COLUMN onboarding_complete boolean NOT NULL DEFAULT false;

-- 2. Add nozzle_label to station_pumps (e.g. "PUMP 1 N1")
--    Add tank_id FK for tank-to-nozzle mapping
ALTER TABLE public.station_pumps
  ADD COLUMN nozzle_label text,
  ADD COLUMN tank_id uuid REFERENCES station_tanks(id) ON DELETE SET NULL;

-- 3. Add opening_stock to station_tanks
ALTER TABLE public.station_tanks
  ADD COLUMN opening_stock numeric DEFAULT 0;

-- 4. Rework station_banks into lodgements
--    Add lodgement_type (POS, Bank Deposit, Cash, etc.), terminal_id, balance
ALTER TABLE public.station_banks
  ADD COLUMN lodgement_type text NOT NULL DEFAULT 'bank_deposit'
    CHECK (lodgement_type IN ('pos', 'bank_deposit', 'cash', 'other')),
  ADD COLUMN terminal_id text,
  ADD COLUMN balance numeric DEFAULT 0;
