-- Migration 046: Per-compartment ullage and liquid height fields
-- Old single-value columns (chart_ullage, chart_liquid_height, etc.) are kept
-- for backward compatibility. New columns store per-compartment values.

ALTER TABLE product_receipts
  ADD COLUMN IF NOT EXISTS chart_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_ullage_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_liquid_height_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_liquid_height_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_liquid_height_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_ullage_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_liquid_height_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_liquid_height_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_liquid_height_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_ullage_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_ullage_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_ullage_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_liquid_height_1 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_liquid_height_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station_liquid_height_3 numeric DEFAULT 0;

-- Backfill: copy old single values into compartment 1
UPDATE product_receipts SET
  chart_ullage_1 = COALESCE(chart_ullage, 0),
  chart_liquid_height_1 = COALESCE(chart_liquid_height, 0),
  depot_ullage_1 = COALESCE(depot_ullage, 0),
  depot_liquid_height_1 = COALESCE(depot_liquid_height, 0),
  station_ullage_1 = COALESCE(station_ullage, 0),
  station_liquid_height_1 = COALESCE(station_liquid_height, 0)
WHERE chart_ullage_1 = 0
  AND chart_liquid_height_1 = 0
  AND depot_ullage_1 = 0
  AND depot_liquid_height_1 = 0
  AND station_ullage_1 = 0
  AND station_liquid_height_1 = 0;
