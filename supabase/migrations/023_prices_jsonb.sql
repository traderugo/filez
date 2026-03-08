-- Replace single `price` column with JSONB `prices` for per-fuel-type pricing
-- e.g. {"PMS": 850, "AGO": 990, "DPK": 0}

-- 1. Add new column
ALTER TABLE daily_sales_entries ADD COLUMN prices jsonb DEFAULT '{}';

-- 2. Backfill existing data (old price becomes PMS price)
UPDATE daily_sales_entries
   SET prices = jsonb_build_object('PMS', COALESCE(price, 0), 'AGO', 0, 'DPK', 0)
 WHERE price IS NOT NULL AND price > 0;

-- 3. Drop old column
ALTER TABLE daily_sales_entries DROP COLUMN price;
