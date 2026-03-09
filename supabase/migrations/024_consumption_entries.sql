-- Consumption entries — records fuel taken as consumption/pour back
-- FK to station_customers for who took the fuel

CREATE TABLE consumption_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  customer_id uuid REFERENCES station_customers(id),
  quantity numeric NOT NULL DEFAULT 0,
  fuel_type text NOT NULL CHECK (fuel_type IN ('PMS', 'AGO', 'DPK')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_consumption_org ON consumption_entries(org_id);
CREATE INDEX idx_consumption_date ON consumption_entries(entry_date);

-- RLS
ALTER TABLE consumption_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_consumption" ON consumption_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_insert_consumption" ON consumption_entries FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org_update_consumption" ON consumption_entries FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "org_delete_consumption" ON consumption_entries FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "admin_all_consumption" ON consumption_entries FOR ALL
  USING (org_id = admin_org_id());
