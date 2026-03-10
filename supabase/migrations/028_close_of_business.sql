-- Add close_of_business boolean to daily_sales_entries
ALTER TABLE daily_sales_entries
  ADD COLUMN IF NOT EXISTS close_of_business boolean NOT NULL DEFAULT false;
