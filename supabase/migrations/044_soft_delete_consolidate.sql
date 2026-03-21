-- Update consolidate_entries() to exclude soft-deleted entries from aggregations
-- and to hard-delete both old entries and soft-deleted entries during cleanup.

CREATE OR REPLACE FUNCTION public.consolidate_entries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff      date := CURRENT_DATE - 90;
  v_new_opening date := CURRENT_DATE - 89;
BEGIN
  -- 1. Banks: roll lodgement totals into opening_balance
  UPDATE station_banks sb
  SET opening_balance = sb.opening_balance + agg.total,
      opening_date    = v_new_opening
  FROM (
    SELECT bank_id, SUM(amount) AS total
    FROM lodgement_entries
    WHERE entry_date < v_cutoff AND bank_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY bank_id
  ) agg
  WHERE sb.id = agg.bank_id;

  -- 2. Lube products: roll net stock movement (received - sold) into opening_stock
  UPDATE station_lube_products
  SET opening_stock = opening_stock + agg.net,
      opening_date  = v_new_opening
  FROM (
    SELECT product_id, SUM(unit_received - unit_sold) AS net
    FROM lube_sales_entries
    WHERE entry_date < v_cutoff AND product_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY product_id
  ) agg
  WHERE id = agg.product_id;

  -- 3. Customers: roll net balance (sales - payments) into opening_balance
  UPDATE station_customers
  SET opening_balance = opening_balance + agg.net,
      opening_date    = v_new_opening
  FROM (
    SELECT customer_id, SUM(sales_amount - amount_paid) AS net
    FROM customer_payment_entries
    WHERE entry_date < v_cutoff AND customer_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY customer_id
  ) agg
  WHERE id = agg.customer_id;

  -- 4. Tanks: roll product receipt volumes into opening_stock
  UPDATE station_tanks
  SET opening_stock = opening_stock + agg.total,
      opening_date  = v_new_opening
  FROM (
    SELECT tank_id, SUM(actual_volume) AS total
    FROM product_receipt_entries
    WHERE entry_date < v_cutoff AND tank_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY tank_id
  ) agg
  WHERE id = agg.tank_id;

  -- 5. Nozzle readings: deduct net sold from tanks, then advance pump initial_reading.
  CREATE TEMP TABLE _pump_agg ON COMMIT DROP AS
  SELECT
    (nr->>'pump_id')::uuid                                 AS pump_id,
    MAX((nr->>'closing_meter')::numeric)                   AS max_meter,
    SUM(COALESCE((nr->>'pour_back')::numeric, 0))          AS total_pour_back
  FROM daily_sales_entries,
       LATERAL jsonb_array_elements(nozzle_readings) AS nr
  WHERE entry_date < v_cutoff
    AND deleted_at IS NULL
    AND nozzle_readings IS NOT NULL
    AND jsonb_array_length(nozzle_readings) > 0
    AND (nr->>'pump_id') IS NOT NULL
  GROUP BY (nr->>'pump_id')::uuid;

  -- 5b. Deduct net sold per tank
  UPDATE station_tanks st
  SET opening_stock = opening_stock - deduct.total
  FROM (
    SELECT sp.tank_id,
           SUM(GREATEST(pa.max_meter - sp.initial_reading, 0) - pa.total_pour_back) AS total
    FROM _pump_agg pa
    JOIN station_pumps sp ON sp.id = pa.pump_id
    WHERE sp.tank_id IS NOT NULL
    GROUP BY sp.tank_id
  ) deduct
  WHERE st.id = deduct.tank_id AND deduct.total > 0;

  -- 5c. Advance pump initial_reading
  UPDATE station_pumps sp
  SET initial_reading = pa.max_meter,
      opening_date    = v_new_opening
  FROM _pump_agg pa
  WHERE sp.id = pa.pump_id;

  -- 6. Hard-delete old entries (>90 days) AND any soft-deleted entries (>7 days)
  -- Old entries get consolidated above; soft-deleted entries are just garbage collected
  DELETE FROM daily_sales_entries      WHERE entry_date < v_cutoff OR (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days');
  DELETE FROM product_receipt_entries  WHERE entry_date < v_cutoff OR (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days');
  DELETE FROM lodgement_entries        WHERE entry_date < v_cutoff OR (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days');
  DELETE FROM lube_sales_entries       WHERE entry_date < v_cutoff OR (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days');
  DELETE FROM lube_stock_entries       WHERE entry_date < v_cutoff OR (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days');
  DELETE FROM customer_payment_entries WHERE entry_date < v_cutoff OR (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days');

  RETURN jsonb_build_object('ok', true, 'cutoff', v_cutoff);
END;
$$;
