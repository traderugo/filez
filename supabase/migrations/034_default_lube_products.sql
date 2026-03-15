
-- Drop all existing lube products and replace with defaults for all stations.

DELETE FROM station_lube_products;

DO $$
DECLARE
  org RECORD;
  prod TEXT;
  i INT;
  products TEXT[] := ARRAY[
    'RAINOIL SUPREME 4L',
    'RAINOIL UNIVERSAL SAE 40 4L',
    'RAINOIL UNIVERSAL SAE 40 25L',
    'MAGNATEC 10W-40 4L',
    'INJECTOR CLEANER',
    'MAGNATEC 5W-30 1L',
    'MAGNATEC 5W-30 4L',
    'MAGNATEC 5W-30 A5',
    'RAINOIL SUPREME 1L',
    'RADICOOL',
    'BRAKE FLUID DOT 4 0.2L',
    'BRAKE FLUID DOT 4 0.5L',
    'GT X ESSENTIAL 20W-50 1L',
    'GT X ESSENTIAL 20W-50 4L',
    'POWER RACING 40 10W-50',
    'MOTOR OIL SAE 40',
    'EDGE PROFESSIONAL',
    'GT X ESSENTIAL 15W-40 4L',
    'GT X ESSENTIAL 15W-40 5L',
    'POWER MAX HD-40 (RETAIL OIL)',
    'ATF DEX II'
  ];
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    i := 0;
    FOREACH prod IN ARRAY products LOOP
      INSERT INTO station_lube_products (org_id, product_name, unit_price, opening_stock, opening_date, sort_order)
      VALUES (org.id, prod, 0, 0, CURRENT_DATE, i);
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;
