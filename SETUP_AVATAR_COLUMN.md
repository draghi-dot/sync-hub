# Setup Avatar Column for Group Chats

The group chat feature requires the `avatar_url` column in the `chats` table. 

## Quick Fix

Run this SQL script in your Supabase SQL Editor:

```sql
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.chats.avatar_url IS 'Profile picture URL for group chats';
```

Or run the script file:
```bash
scripts/038_add_chat_avatar.sql
```

## Steps

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Paste the SQL above (or run `scripts/038_add_chat_avatar.sql`)
4. Click **Run**

After running this, group chats will support profile pictures. Until then, groups can be created without pictures.

