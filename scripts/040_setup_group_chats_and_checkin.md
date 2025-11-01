# Setup Guide: Group Chats & Check-In Features

This guide will help you set up the new group chat and check-in features.

## Features Added

1. **Group Chat Creation**: Users can create group chats with 3+ people, name them, and add profile pictures
2. **Check-In Posts**: BeReal-style daily check-ins where users can post one photo of themselves per day

## Database Setup

### 1. Add Avatar URL to Chats Table

Run this SQL script to add support for group chat profile pictures:

```bash
scripts/038_add_chat_avatar.sql
```

Or run directly in Supabase SQL Editor:
```sql
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.chats.avatar_url IS 'Profile picture URL for group chats';
```

### 2. Add Post Type Column for Check-Ins

Run this SQL script to add support for check-in posts:

```bash
scripts/039_add_post_type_checkin.sql
```

Or run directly in Supabase SQL Editor:
```sql
-- Add post_type column to support different post types (regular posts, check-ins)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post', 'checkin'));

-- Add index for filtering check-ins
CREATE INDEX IF NOT EXISTS posts_post_type_idx ON public.posts(post_type, created_at DESC);

-- Add comment to explain the column
COMMENT ON COLUMN public.posts.post_type IS 'Type of post: "post" for regular posts, "checkin" for BeReal-style daily check-ins';
```

## How It Works

### Group Chats

1. Click the **+** button in the Chats page header
2. Enter a group name (required)
3. Optionally upload a profile picture for the group
4. Search for and add at least 2 other members
5. Click "Create Group" to create the chat

**Features:**
- Groups must have at least 3 members (creator + 2 others)
- Group avatars are stored in Supabase Storage (`chat-files` bucket)
- Group chats appear in the chat list with their custom avatar
- All members can see and participate in the group chat

### Check-In Posts

1. Click the **"Check In"** button next to the post creation area in the Feed
2. Take or select a photo of yourself
3. The photo is automatically posted as a check-in

**Features:**
- One check-in per day per user
- Check-ins are marked with a special badge
- Check-in photos are stored in Supabase Storage (`check-ins/` folder)
- Check-ins appear in the feed like regular posts but with a "Check-In" badge

## Storage Setup

Make sure the `chat-files` bucket exists in Supabase Storage (used for both group avatars and check-in images):

1. Go to **Supabase Dashboard** → **Storage**
2. If `chat-files` doesn't exist:
   - Click **"New bucket"**
   - Name: `chat-files`
   - Make it **Public** or set up RLS policies
   - File size limit: 10 MB
3. Run the storage policies script (if not already done):
   ```bash
   scripts/024_setup_storage_policies.sql
   ```

## UI Changes

### Chats Page
- Added **+** button in header to create group chats
- Group chats display their custom avatar in the chat list
- Group chats are labeled as "Group chat" in the list

### Feed Page
- Added **"Check In"** button next to the post creation area
- Button shows "Checked In Today" if user has already checked in today
- Check-in posts display with a "Check-In" badge and image

### Post Display
- Regular posts with images display the image
- Check-in posts display with a camera icon badge
- Check-in images are shown in a square aspect ratio

## Troubleshooting

### Group Chat Avatar Not Uploading
- Check that `chat-files` bucket exists
- Verify RLS policies are set (run `024_setup_storage_policies.sql`)
- Check browser console for specific error messages

### Check-In Button Shows "Checked In Today" When It Shouldn't
- Verify `post_type` column exists in `posts` table
- Check that `post_type` is set to `'checkin'` when creating check-in posts
- The check-in detection uses the current date (midnight to midnight UTC)

### Check-In Button Always Shows "Loading..."
- Check browser console for errors
- Verify database connection is working
- Make sure `posts` table exists and is accessible

## Testing

1. **Test Group Chat Creation:**
   - Create a group with 3+ members
   - Verify avatar upload works
   - Check that all members can see the chat

2. **Test Check-In:**
   - Post a check-in photo
   - Verify it appears in feed with "Check-In" badge
   - Try to post another check-in same day - should be blocked
   - Wait until next day and verify you can check in again

3. **Test Both Features Together:**
   - Create multiple group chats with different avatars
   - Post regular posts and check-ins
   - Verify feed shows all post types correctly

