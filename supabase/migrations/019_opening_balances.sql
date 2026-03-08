-- Migration 019: Opening balances + entity FK links
-- Adds opening_date to config tables, creates station_customers,
-- links entry tables to config tables via FK (replaces free-text fields),
-- creates balance calculation views

-- ============================================
-- 1. Add opening_date to existing config tables
-- ============================================
ALTER TABLE station_tanks ADD COLUMN opening_date date DEFAULT CURRENT_DATE;
ALTER TABLE station_pumps ADD COLUMN opening_date date DEFAULT CURRENT_DATE;

-- Rename balance → opening_balance on station_banks + add opening_date
ALTER TABLE station_banks RENAME COLUMN balance TO opening_balance;
ALTER TABLE station_banks ADD COLUMN opening_date date DEFAULT CURRENT_DATE;

-- Add opening_stock + opening_date to lube products
ALTER TABLE station_lube_products
  ADD COLUMN opening_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN opening_date date DEFAULT CURRENT_DATE;

-- ============================================
-- 2. Create station_customers (credit customers)
-- ============================================
CREATE TABLE station_customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_date date DEFAULT CURRENT_DATE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_station_customers_org ON station_customers(org_id);

ALTER TABLE station_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_customers" ON station_customers FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_customers" ON station_customers FOR ALL
  USING (org_id = admin_org_id());

-- ============================================
-- 3. Add FK columns to entry tables, drop free-text columns
--    (no data exists — clean replacement)
-- ============================================

-- Product receipts → link to tank that received the fuel
ALTER TABLE product_receipt_entries
  ADD COLUMN tank_id uuid REFERENCES station_tanks(id) ON DELETE SET NULL;

-- Lodgements → link to bank account/POS terminal
ALTER TABLE lodgement_entries
  ADD COLUMN bank_id uuid REFERENCES station_banks(id) ON DELETE SET NULL;
ALTER TABLE lodgement_entries DROP COLUMN bank_name;
-- Keep lodgement_type on entry (entry type ≠ bank type: 'deposit'/'lube-deposit'/'pos' vs 'pos'/'bank_deposit'/'cash'/'other')

-- Lube sales → link to product
ALTER TABLE lube_sales_entries
  ADD COLUMN product_id uuid REFERENCES station_lube_products(id) ON DELETE SET NULL;
ALTER TABLE lube_sales_entries DROP COLUMN product;

-- Lube stock (physical count / reconciliation) → link to product
ALTER TABLE lube_stock_entries
  ADD COLUMN product_id uuid REFERENCES station_lube_products(id) ON DELETE SET NULL;
ALTER TABLE lube_stock_entries DROP COLUMN product;

-- Customer payments → link to customer
ALTER TABLE customer_payment_entries
  ADD COLUMN customer_id uuid REFERENCES station_customers(id) ON DELETE SET NULL;
ALTER TABLE customer_payment_entries DROP COLUMN customer_name;

-- ============================================
-- 4. Indexes on new FK columns
-- ============================================
CREATE INDEX idx_receipt_tank ON product_receipt_entries(tank_id);
CREATE INDEX idx_lodgement_bank ON lodgement_entries(bank_id);
CREATE INDEX idx_lube_sales_product ON lube_sales_entries(product_id);
CREATE INDEX idx_lube_stock_product ON lube_stock_entries(product_id);
CREATE INDEX idx_customer_payment_customer ON customer_payment_entries(customer_id);

-- ============================================
-- 5. Balance calculation views
-- ============================================

-- Bank/lodgement balances: opening + deposits
CREATE OR REPLACE VIEW current_bank_balances AS
SELECT
  b.id,
  b.org_id,
  b.bank_name,
  b.lodgement_type,
  b.opening_balance,
  b.opening_date,
  COALESCE(SUM(le.amount), 0) AS total_lodgements,
  b.opening_balance + COALESCE(SUM(le.amount), 0) AS current_balance
FROM station_banks b
LEFT JOIN lodgement_entries le ON le.bank_id = b.id
GROUP BY b.id;

-- Lube product balances: opening + received - sold
CREATE OR REPLACE VIEW current_lube_balances AS
SELECT
  lp.id,
  lp.org_id,
  lp.product_name,
  lp.unit_price,
  lp.opening_stock,
  lp.opening_date,
  COALESCE(SUM(ls.unit_received), 0) AS total_received,
  COALESCE(SUM(ls.unit_sold), 0) AS total_sold,
  lp.opening_stock
    + COALESCE(SUM(ls.unit_received), 0)
    - COALESCE(SUM(ls.unit_sold), 0) AS current_stock
FROM station_lube_products lp
LEFT JOIN lube_sales_entries ls ON ls.product_id = lp.id
GROUP BY lp.id;

-- Customer credit balances: opening + sales - payments (positive = customer owes)
CREATE OR REPLACE VIEW current_customer_balances AS
SELECT
  c.id,
  c.org_id,
  c.name,
  c.phone,
  c.opening_balance,
  c.opening_date,
  COALESCE(SUM(cp.sales_amount), 0) AS total_sales,
  COALESCE(SUM(cp.amount_paid), 0) AS total_paid,
  c.opening_balance
    + COALESCE(SUM(cp.sales_amount), 0)
    - COALESCE(SUM(cp.amount_paid), 0) AS current_balance
FROM station_customers c
LEFT JOIN customer_payment_entries cp ON cp.customer_id = c.id
GROUP BY c.id;

-- Function: calculate total nozzle sales for a given tank
-- Extracts closing_meter and pour_back from daily_sales_entries JSONB,
-- joins through station_pumps.tank_id.
-- Net sold per pump = MAX(closing_meter) - initial_reading - SUM(pour_back)
CREATE OR REPLACE FUNCTION tank_nozzle_sales(p_tank_id uuid)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(sub.net_sold), 0)
  FROM (
    SELECT
      sp.id AS pump_id,
      GREATEST(
        MAX((nr->>'closing_meter')::numeric) - sp.initial_reading, 0
      ) - COALESCE(SUM((nr->>'pour_back')::numeric), 0) AS net_sold
    FROM station_pumps sp
    JOIN daily_sales_entries dse ON dse.org_id = sp.org_id
    CROSS JOIN LATERAL jsonb_array_elements(dse.nozzle_readings) AS nr
    WHERE sp.tank_id = p_tank_id
      AND (nr->>'pump_id')::uuid = sp.id
    GROUP BY sp.id, sp.initial_reading
  ) sub
$$;

-- Tank balances: opening + receipts - nozzle sales
CREATE OR REPLACE VIEW current_tank_balances AS
SELECT
  t.id,
  t.org_id,
  t.fuel_type,
  t.tank_number,
  t.capacity,
  t.opening_stock,
  t.opening_date,
  COALESCE(SUM(pr.actual_volume), 0) AS total_received,
  tank_nozzle_sales(t.id) AS total_sold,
  t.opening_stock
    + COALESCE(SUM(pr.actual_volume), 0)
    - tank_nozzle_sales(t.id) AS current_stock
FROM station_tanks t
LEFT JOIN product_receipt_entries pr ON pr.tank_id = t.id
GROUP BY t.id;
