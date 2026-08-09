/*
# Create store storage bucket

1. Storage
- Creates a public bucket `store` for second-hand store listing images.
2. Security
- Public read for store images (anyone can browse the store).
- Authenticated users can upload to the `store` bucket.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('store', 'store', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "store_public_read" ON storage.objects;
CREATE POLICY "store_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'store');

-- Authenticated upload
DROP POLICY IF EXISTS "store_auth_upload" ON storage.objects;
CREATE POLICY "store_auth_upload"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'store');
