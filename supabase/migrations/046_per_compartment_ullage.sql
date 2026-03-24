-- Migration 046: Per-compartment ullage, liquid height, and volume fields
-- Old single-value columns are kept for backward compatibility.

ALTER TABLE product_receipt_entries
  -- Chart: highest ullage, lowest ullage (replaces old chart_ullage)
  ADD COLUMN IF NOT EXISTS chart_high_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_high_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_high_ullage_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_low_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_low_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_low_ullage_3 numeric DEFAULT 0,
  -- Chart: liquid height per compartment
  ADD COLUMN IF NOT EXISTS chart_liquid_height_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_liquid_height_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_liquid_height_3 numeric DEFAULT 0,
  -- Depot: ullage per compartment
  ADD COLUMN IF NOT EXISTS depot_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_ullage_3 numeric DEFAULT 0,
  -- Depot: liquid height per compartment
  ADD COLUMN IF NOT EXISTS depot_liquid_height_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_liquid_height_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_liquid_height_3 numeric DEFAULT 0,
  -- Station: ullage per compartment
  ADD COLUMN IF NOT EXISTS station_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_ullage_3 numeric DEFAULT 0,
  -- Station: liquid height per compartment
  ADD COLUMN IF NOT EXISTS station_liquid_height_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_liquid_height_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_liquid_height_3 numeric DEFAULT 0,
  -- Compartment volumes: highest and lowest (replaces first/second/third_compartment)
  ADD COLUMN IF NOT EXISTS high_vol_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_vol_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_vol_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_vol_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_vol_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_vol_3 numeric DEFAULT 0;

-- Backfill: copy old single values into new per-compartment columns
UPDATE product_receipt_entries SET
  chart_high_ullage_1 = COALESCE(chart_ullage, 0),
  chart_liquid_height_1 = COALESCE(chart_liquid_height, 0),
  depot_ullage_1 = COALESCE(depot_ullage, 0),
  depot_liquid_height_1 = COALESCE(depot_liquid_height, 0),
  station_ullage_1 = COALESCE(station_ullage, 0),
  station_liquid_height_1 = COALESCE(station_liquid_height, 0),
  high_vol_1 = COALESCE(first_compartment, 0),
  high_vol_2 = COALESCE(second_compartment, 0),
  high_vol_3 = COALESCE(third_compartment, 0)
WHERE chart_high_ullage_1 = 0
  AND high_vol_1 = 0
  AND high_vol_2 = 0
  AND high_vol_3 = 0;
