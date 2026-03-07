-- Entry tables for all 6 entry types
-- Run in Supabase SQL Editor after 015

-- ============================================
-- 1. Drop old report tables (order matters for FK deps)
-- ============================================
DROP TABLE IF EXISTS dso_pos CASCADE;
DROP TABLE IF EXISTS dso_consumption CASCADE;
DROP TABLE IF EXISTS dso_tank_readings CASCADE;
DROP TABLE IF EXISTS dso_pump_readings CASCADE;
DROP TABLE IF EXISTS dso_daily CASCADE;
DROP TABLE IF EXISTS lube_transactions CASCADE;
DROP TABLE IF EXISTS lube_monthly_stock CASCADE;
DROP TABLE IF EXISTS lube_daily CASCADE;

-- ============================================
-- 2. Daily Sales Entries
-- ============================================
CREATE TABLE daily_sales_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  nozzle_readings jsonb NOT NULL DEFAULT '[]',
  ugt_closing_stock numeric DEFAULT 0,
  price numeric DEFAULT 0,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_sales_org ON daily_sales_entries(org_id);
CREATE INDEX idx_daily_sales_date ON daily_sales_entries(entry_date);

-- ============================================
-- 3. Product Receipt Entries
-- ============================================
CREATE TABLE product_receipt_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  loaded_date date,
  driver_name text,
  waybill_number text,
  ticket_number text,
  truck_number text,
  chart_ullage numeric DEFAULT 0,
  chart_liquid_height numeric DEFAULT 0,
  depot_ullage numeric DEFAULT 0,
  depot_liquid_height numeric DEFAULT 0,
  station_ullage numeric DEFAULT 0,
  station_liquid_height numeric DEFAULT 0,
  first_compartment numeric DEFAULT 0,
  second_compartment numeric DEFAULT 0,
  third_compartment numeric DEFAULT 0,
  actual_volume numeric DEFAULT 0,
  depot_name text,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_receipt_org ON product_receipt_entries(org_id);
CREATE INDEX idx_product_receipt_date ON product_receipt_entries(entry_date);

-- ============================================
-- 4. Lodgement Entries
-- ============================================
CREATE TABLE lodgement_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  bank_name text NOT NULL,
  lodgement_type text NOT NULL CHECK (lodgement_type IN ('deposit', 'lube-deposit', 'pos')),
  sales_date date,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lodgement_org ON lodgement_entries(org_id);
CREATE INDEX idx_lodgement_date ON lodgement_entries(entry_date);

-- ============================================
-- 5. Lube Sales Entries
-- ============================================
CREATE TABLE lube_sales_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  product text NOT NULL,
  unit_sold numeric DEFAULT 0,
  unit_received numeric DEFAULT 0,
  price numeric DEFAULT 0,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lube_sales_org ON lube_sales_entries(org_id);
CREATE INDEX idx_lube_sales_date ON lube_sales_entries(entry_date);

-- ============================================
-- 6. Lube Stock Entries
-- ============================================
CREATE TABLE lube_stock_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  product text NOT NULL,
  stock numeric DEFAULT 0,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lube_stock_org ON lube_stock_entries(org_id);
CREATE INDEX idx_lube_stock_date ON lube_stock_entries(entry_date);

-- ============================================
-- 7. Customer Payment Entries
-- ============================================
CREATE TABLE customer_payment_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  customer_name text NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  sales_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customer_payment_org ON customer_payment_entries(org_id);
CREATE INDEX idx_customer_payment_date ON customer_payment_entries(entry_date);

-- ============================================
-- 8. RLS Policies
-- ============================================
ALTER TABLE daily_sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_receipt_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lodgement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lube_sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lube_stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_entries ENABLE ROW LEVEL SECURITY;

-- Org members can read entries for their org
CREATE POLICY "org_read_daily_sales" ON daily_sales_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_read_product_receipt" ON product_receipt_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_read_lodgements" ON lodgement_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_read_lube_sales" ON lube_sales_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_read_lube_stock" ON lube_stock_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_read_customer_payment" ON customer_payment_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Org members can insert entries for their org
CREATE POLICY "org_insert_daily_sales" ON daily_sales_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_insert_product_receipt" ON product_receipt_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_insert_lodgements" ON lodgement_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_insert_lube_sales" ON lube_sales_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_insert_lube_stock" ON lube_stock_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "org_insert_customer_payment" ON customer_payment_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Org members can update their own entries
CREATE POLICY "org_update_daily_sales" ON daily_sales_entries FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "org_update_product_receipt" ON product_receipt_entries FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "org_update_lodgements" ON lodgement_entries FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "org_update_lube_sales" ON lube_sales_entries FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "org_update_lube_stock" ON lube_stock_entries FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "org_update_customer_payment" ON customer_payment_entries FOR UPDATE
  USING (created_by = auth.uid());

-- Org members can delete their own entries
CREATE POLICY "org_delete_daily_sales" ON daily_sales_entries FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY "org_delete_product_receipt" ON product_receipt_entries FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY "org_delete_lodgements" ON lodgement_entries FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY "org_delete_lube_sales" ON lube_sales_entries FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY "org_delete_lube_stock" ON lube_stock_entries FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY "org_delete_customer_payment" ON customer_payment_entries FOR DELETE
  USING (created_by = auth.uid());

-- Admin can manage all entries for their org
CREATE POLICY "admin_all_daily_sales" ON daily_sales_entries FOR ALL
  USING (org_id = admin_org_id());
CREATE POLICY "admin_all_product_receipt" ON product_receipt_entries FOR ALL
  USING (org_id = admin_org_id());
CREATE POLICY "admin_all_lodgements" ON lodgement_entries FOR ALL
  USING (org_id = admin_org_id());
CREATE POLICY "admin_all_lube_sales" ON lube_sales_entries FOR ALL
  USING (org_id = admin_org_id());
CREATE POLICY "admin_all_lube_stock" ON lube_stock_entries FOR ALL
  USING (org_id = admin_org_id());
CREATE POLICY "admin_all_customer_payment" ON customer_payment_entries FOR ALL
  USING (org_id = admin_org_id());
