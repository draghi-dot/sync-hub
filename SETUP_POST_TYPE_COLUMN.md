# Setup Post Type Column

The post type column is needed for separating regular posts from check-ins. However, the app will work without it (backwards compatible).

## To Enable Check-In Feature

Run this SQL script in your Supabase SQL Editor:

```sql
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post', 'checkin'));

CREATE INDEX IF NOT EXISTS posts_post_type_idx ON public.posts(post_type, created_at DESC);

COMMENT ON COLUMN public.posts.post_type IS 'Type of post: "post" for regular posts, "checkin" for BeReal-style daily check-ins';
```

Or run the script file:
```bash
scripts/039_add_post_type_checkin.sql
```

## Steps

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Paste the SQL above (or run `scripts/039_add_post_type_checkin.sql`)
4. Click **Run**

## Without This Column

- Posts will still work (they just won't have a post_type)
- Check-ins will still work (but won't be filtered separately)
- The app is backwards compatible

## With This Column

- Regular posts and check-ins are properly separated
- Feed tab shows only regular posts
- Check-In tab shows only check-ins
- Better filtering and organization

