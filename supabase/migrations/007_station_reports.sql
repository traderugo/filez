-- Station configuration tables (per org = per fuel station)

-- Pumps: PMS/AGO/DPK with numbered pumps
CREATE TABLE station_pumps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fuel_type text NOT NULL CHECK (fuel_type IN ('PMS', 'AGO', 'DPK')),
  pump_number int NOT NULL,
  initial_reading numeric DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, fuel_type, pump_number)
);

-- Tanks: fuel storage tanks with capacity
CREATE TABLE station_tanks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fuel_type text NOT NULL CHECK (fuel_type IN ('PMS', 'AGO', 'DPK')),
  tank_number int NOT NULL,
  capacity numeric DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, fuel_type, tank_number)
);

-- Banks for POS and lodgement tracking
CREATE TABLE station_banks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Lube products with unit prices
CREATE TABLE station_lube_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit_price numeric DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Consumption categories per fuel type
CREATE TABLE station_consumption_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fuel_type text NOT NULL CHECK (fuel_type IN ('PMS', 'AGO', 'DPK')),
  category_name text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- DSO Daily Data
-- ============================================

-- Master daily record (one per station per date)
CREATE TABLE dso_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  lodgement_amount numeric DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, entry_date)
);

-- Pump readings per day
CREATE TABLE dso_pump_readings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_id uuid NOT NULL REFERENCES dso_daily(id) ON DELETE CASCADE,
  pump_id uuid NOT NULL REFERENCES station_pumps(id) ON DELETE CASCADE,
  opening numeric DEFAULT 0,
  closing numeric DEFAULT 0,
  consumed numeric DEFAULT 0,
  price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tank readings per day
CREATE TABLE dso_tank_readings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_id uuid NOT NULL REFERENCES dso_daily(id) ON DELETE CASCADE,
  tank_id uuid NOT NULL REFERENCES station_tanks(id) ON DELETE CASCADE,
  opening numeric DEFAULT 0,
  waybill_supply numeric DEFAULT 0,
  actual_supply numeric DEFAULT 0,
  closing numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Consumption entries per day
CREATE TABLE dso_consumption (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_id uuid NOT NULL REFERENCES dso_daily(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES station_consumption_categories(id) ON DELETE CASCADE,
  quantity numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- POS entries per day per bank
CREATE TABLE dso_pos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_id uuid NOT NULL REFERENCES dso_daily(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES station_banks(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- Lube Data
-- ============================================

-- Master daily lube record
CREATE TABLE lube_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  lodgement numeric DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, entry_date)
);

-- Lube transactions (sales or received stock)
CREATE TABLE lube_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_id uuid NOT NULL REFERENCES lube_daily(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES station_lube_products(id) ON DELETE CASCADE,
  quantity int DEFAULT 0,
  tx_type text NOT NULL CHECK (tx_type IN ('sale', 'received')),
  created_at timestamptz DEFAULT now()
);

-- Monthly lube opening stock per product
CREATE TABLE lube_monthly_stock (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES station_lube_products(id) ON DELETE CASCADE,
  month date NOT NULL, -- first day of month
  opening_stock int DEFAULT 0,
  UNIQUE(org_id, product_id, month)
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE station_pumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_lube_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_consumption_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dso_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE dso_pump_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dso_tank_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dso_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE dso_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lube_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE lube_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lube_monthly_stock ENABLE ROW LEVEL SECURITY;

-- All station config + data readable by org members, writable by admin
CREATE POLICY "org_members_read_pumps" ON station_pumps FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_pumps" ON station_pumps FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_tanks" ON station_tanks FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_tanks" ON station_tanks FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_banks" ON station_banks FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_banks" ON station_banks FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_lube_products" ON station_lube_products FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_lube_products" ON station_lube_products FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_consumption_cats" ON station_consumption_categories FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_consumption_cats" ON station_consumption_categories FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_dso_daily" ON dso_daily FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_dso_daily" ON dso_daily FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_pump_readings" ON dso_pump_readings FOR SELECT USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));
CREATE POLICY "admin_manage_pump_readings" ON dso_pump_readings FOR ALL USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id = admin_org_id()));

CREATE POLICY "org_members_read_tank_readings" ON dso_tank_readings FOR SELECT USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));
CREATE POLICY "admin_manage_tank_readings" ON dso_tank_readings FOR ALL USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id = admin_org_id()));

CREATE POLICY "org_members_read_consumption" ON dso_consumption FOR SELECT USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));
CREATE POLICY "admin_manage_consumption" ON dso_consumption FOR ALL USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id = admin_org_id()));

CREATE POLICY "org_members_read_pos" ON dso_pos FOR SELECT USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));
CREATE POLICY "admin_manage_pos" ON dso_pos FOR ALL USING (daily_id IN (SELECT id FROM dso_daily WHERE org_id = admin_org_id()));

CREATE POLICY "org_members_read_lube_daily" ON lube_daily FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_lube_daily" ON lube_daily FOR ALL USING (org_id = admin_org_id());

CREATE POLICY "org_members_read_lube_tx" ON lube_transactions FOR SELECT USING (daily_id IN (SELECT id FROM lube_daily WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())));
CREATE POLICY "admin_manage_lube_tx" ON lube_transactions FOR ALL USING (daily_id IN (SELECT id FROM lube_daily WHERE org_id = admin_org_id()));

CREATE POLICY "org_members_read_lube_stock" ON lube_monthly_stock FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
CREATE POLICY "admin_manage_lube_stock" ON lube_monthly_stock FOR ALL USING (org_id = admin_org_id());
