-- Backfill default accounts for all existing stations.
-- Default accounts have phone = 'DEFAULT' and cannot be deleted via UI.

DO $$
DECLARE
  org RECORD;
  acct TEXT;
  i INT;
  accounts TEXT[] := ARRAY[
    'Police',
    'Manager Car',
    'DSS OFFICIALS',
    'Army',
    'EDSTMA',
    'Weight and Measures',
    'Vigilante',
    'Security Agents',
    'Regional Manager Car',
    'Area Manager Car',
    'LOGISTICS',
    'Pour Back After Pump Repairs',
    'Generator',
    'MDS Logistics Truck',
    'Logistics Truck',
    'Police/Army',
    'DPR',
    'Others',
    'Pour Back'
  ];
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    i := 1000;
    FOREACH acct IN ARRAY accounts LOOP
      -- Only insert if this default account doesn't already exist for the org
      INSERT INTO station_customers (org_id, name, phone, opening_balance, opening_date, sort_order)
      SELECT org.id, acct, 'DEFAULT', 0, CURRENT_DATE, i
      WHERE NOT EXISTS (
        SELECT 1 FROM station_customers
        WHERE org_id = org.id AND name = acct AND phone = 'DEFAULT'
      );
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;
