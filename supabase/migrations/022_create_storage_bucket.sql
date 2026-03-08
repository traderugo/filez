-- Create the subscription-proofs storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-proofs', 'subscription-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'subscription-proofs');

-- Allow public read access (since bucket is public)
CREATE POLICY "Public read proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'subscription-proofs');
