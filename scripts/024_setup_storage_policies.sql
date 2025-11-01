-- 024_setup_storage_policies.sql
-- This script sets up Row Level Security policies for the chat-files storage bucket
-- NOTE: The bucket itself must be created manually in the Supabase Dashboard first
-- Storage → New bucket → Name: "chat-files"

-- IMPORTANT: Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies for chat-files bucket to start fresh
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND (definition LIKE '%chat-files%' OR policyname LIKE '%chat%')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Policy 1: Allow authenticated users to INSERT (upload) files to chat-files bucket
-- This is the most permissive - any authenticated user can upload
CREATE POLICY "chat_files_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
);

-- Policy 2: Allow authenticated users to SELECT (read/download) files from chat-files bucket
CREATE POLICY "chat_files_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files'
);

-- Policy 3: Allow authenticated users to DELETE files from chat-files bucket
-- This allows cleanup by any authenticated user
CREATE POLICY "chat_files_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files'
);

-- Policy 4: Allow authenticated users to UPDATE file metadata
CREATE POLICY "chat_files_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-files'
)
WITH CHECK (
  bucket_id = 'chat-files'
);

-- Verification queries (uncomment to run after applying policies)
-- Check if bucket exists:
-- SELECT name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE name = 'chat-files';

-- Check policies:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'chat_files%';

