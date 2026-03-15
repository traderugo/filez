-- Excel templates table
CREATE TABLE IF NOT EXISTS excel_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  file_size   bigint NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE excel_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write excel_templates
CREATE POLICY "Admin full access to excel_templates"
ON excel_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Storage bucket for excel templates (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-templates', 'excel-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload/read/delete from this bucket
CREATE POLICY "Admin upload excel templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'excel-templates'
  AND EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin read excel templates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'excel-templates'
  AND EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin delete excel templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'excel-templates'
  AND EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
