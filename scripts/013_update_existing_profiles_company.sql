-- Update existing profiles with company from user metadata
-- This script updates profiles for users who signed up before company was properly saved

UPDATE profiles
SET company = (
  SELECT 
    coalesce(
      (auth.users.raw_user_meta_data ->> 'company'),
      profiles.company
    )
  FROM auth.users
  WHERE auth.users.id = profiles.id
)
WHERE company IS NULL OR company = '';

-- Also update full_name from metadata if missing
UPDATE profiles
SET full_name = (
  SELECT 
    coalesce(
      (auth.users.raw_user_meta_data ->> 'full_name'),
      profiles.full_name
    )
  FROM auth.users
  WHERE auth.users.id = profiles.id
)
WHERE full_name IS NULL OR full_name = '';

