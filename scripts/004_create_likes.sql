-- Create likes table
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(post_id, user_id)
);

-- Enable RLS
alter table public.likes enable row level security;

-- RLS Policies for likes
-- Everyone can view all likes
create policy "likes_select_all"
  on public.likes for select
  using (true);

-- Authenticated users can create likes
create policy "likes_insert_authenticated"
  on public.likes for insert
  with check (auth.uid() = user_id);

-- Users can only delete their own likes
create policy "likes_delete_own"
  on public.likes for delete
  using (auth.uid() = user_id);

-- Create indexes for faster lookups
create index if not exists likes_post_id_idx on public.likes(post_id);
create index if not exists likes_user_id_idx on public.likes(user_id);
