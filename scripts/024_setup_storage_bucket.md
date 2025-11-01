# Setup Supabase Storage Bucket for File Attachments

This guide will help you set up the `chat-files` storage bucket for file attachments in chats.

## Steps to Create the Bucket

### 1. Via Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"** button
5. Configure the bucket:
   - **Name**: `chat-files`
   - **Public bucket**: ✅ Check this (or configure RLS policies manually)
   - **File size limit**: 10 MB (recommended)
   - **Allowed MIME types**: Leave empty to allow all types (or specify allowed types)

6. Click **"Create bucket"**

### 2. Set Up RLS Policies (REQUIRED)

**IMPORTANT:** Even if your bucket is public, you may still need RLS policies if the bucket was created as private or if RLS is enabled.

Run this SQL script in your Supabase SQL Editor:
```bash
scripts/024_setup_storage_policies.sql
```

Or manually create the policies:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the script `scripts/024_setup_storage_policies.sql`

This script will:
- Enable RLS on storage.objects (if not already enabled)
- Drop any conflicting policies
- Create 4 policies: INSERT, SELECT, DELETE, UPDATE for authenticated users

**Alternative Manual Setup:**

If you prefer to create policies manually through the Dashboard:

1. Go to **Storage** → **Policies** → `chat-files`
2. Create the following policies:

#### Policy 1: Allow authenticated users to upload files
```sql
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Policy 2: Allow authenticated users to read files
```sql
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-files');
```

#### Policy 3: Allow users to delete their own files (optional)
```sql
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3. Verify the Setup

After creating the bucket, you should be able to:
- Upload files through the chat interface
- See files appear in messages
- Download/view files sent by other users

## Troubleshooting

### Error: "Bucket not found"
- Ensure the bucket name is exactly `chat-files` (case-sensitive)
- Check that the bucket exists in your Supabase project

### Error: "Permission denied"
- Check that RLS policies are set correctly (see above)
- If bucket is public, ensure it's marked as "Public bucket"
- Verify your user is authenticated

### Error: "File size exceeds limit"
- The default limit is 10MB per file
- Adjust the file size limit in bucket settings if needed
- Or modify the limit in `components/chat/chat-input.tsx` (line 26)

## Alternative: Create Bucket via API

If you prefer to create the bucket programmatically, you can use the Supabase Management API:

```bash
curl -X POST 'https://api.supabase.com/v1/projects/{project-ref}/storage/buckets' \
  -H "Authorization: Bearer {service-role-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "chat-files",
    "public": true,
    "file_size_limit": 10485760,
    "allowed_mime_types": null
  }'
```

Replace:
- `{project-ref}` with your project reference ID
- `{service-role-key}` with your service role key (from Project Settings → API)

## Notes

- Files are organized by chat ID: `chat-files/{chatId}/{userId}-{timestamp}.{ext}`
- Each file gets a unique name to prevent conflicts
- Public URLs are generated for easy access
- Files are stored permanently unless manually deleted

