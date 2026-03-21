-- Reset all consumption, pour_back, and consumption_customer_id on nozzle readings
-- so they can be re-entered fresh from the daily sales form.
UPDATE daily_sales_entries
SET nozzle_readings = (
  SELECT jsonb_agg(
    elem - 'consumption' - 'pour_back' - 'consumption_customer_id'
    || jsonb_build_object('consumption', 0, 'pour_back', 0, 'consumption_customer_id', null)
  )
  FROM jsonb_array_elements(nozzle_readings) AS elem
),
updated_at = now()
WHERE nozzle_readings IS NOT NULL
  AND jsonb_array_length(nozzle_readings) > 0;
