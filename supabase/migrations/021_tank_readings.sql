-- Add per-tank closing stock readings to daily sales entries
-- Run in Supabase SQL Editor after 020

ALTER TABLE daily_sales_entries
  ADD COLUMN tank_readings jsonb NOT NULL DEFAULT '[]';

-- Migrate existing data: wrap single ugt_closing_stock into tank_readings array
-- (existing entries will have an empty array; no tank_id mapping available retroactively)
