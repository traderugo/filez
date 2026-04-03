-- Create dedicated bucket for imprest receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('imprest-receipts', 'imprest-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Users can upload imprest receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'imprest-receipts');

-- Allow public read access
CREATE POLICY "Public read imprest receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'imprest-receipts');
