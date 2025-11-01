-- Add post_type column to support different post types (regular posts, check-ins)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post', 'checkin'));

-- Add index for filtering check-ins
CREATE INDEX IF NOT EXISTS posts_post_type_idx ON public.posts(post_type, created_at DESC);

-- Add comment to explain the column
COMMENT ON COLUMN public.posts.post_type IS 'Type of post: "post" for regular posts, "checkin" for BeReal-style daily check-ins';

