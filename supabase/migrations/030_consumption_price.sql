-- Add price field to consumption_entries so audit reports can use the
-- actual price at time of entry instead of deriving it from daily sales.
ALTER TABLE consumption_entries
  ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;
