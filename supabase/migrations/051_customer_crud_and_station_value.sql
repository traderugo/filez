-- Add station_value_tracked flag to customer accounts
ALTER TABLE station_customers
  ADD COLUMN IF NOT EXISTS station_value_tracked boolean NOT NULL DEFAULT false;
