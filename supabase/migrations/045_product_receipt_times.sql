-- Add arrival_time and exit_time to product_receipt_entries
-- These are time-only TEXT fields (e.g. "14:30") for when the truck arrived at / left the station.

ALTER TABLE product_receipt_entries ADD COLUMN IF NOT EXISTS arrival_time TEXT;
ALTER TABLE product_receipt_entries ADD COLUMN IF NOT EXISTS exit_time TEXT;
