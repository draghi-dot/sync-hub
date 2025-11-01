-- Add company, is_admin, and totp_secret fields to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS totp_secret TEXT,
ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE;

-- Update RLS policies to include new fields
-- (existing policies will continue to work)
