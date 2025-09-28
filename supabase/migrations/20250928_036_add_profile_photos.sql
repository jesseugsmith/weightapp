-- Create a bucket for profile photos if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('profile-photos', 'profile-photos')
ON CONFLICT (id) DO NOTHING;

-- Add policy to allow authenticated users to upload their own photos
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Add policy to allow users to update their own photos
CREATE POLICY "Users can update their own profile photo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Add policy to allow users to delete their own photos
CREATE POLICY "Users can delete their own profile photo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Add policy to allow public access to profile photos
CREATE POLICY "Profile photos are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

-- Add photo_url column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;
