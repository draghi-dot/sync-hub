-- Add avatar_url column to chats table for group chat profile pictures
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.chats.avatar_url IS 'Profile picture URL for group chats';

