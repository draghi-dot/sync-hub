-- Create comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.comments enable row level security;

-- RLS Policies for comments
-- Everyone can view all comments
create policy "comments_select_all"
  on public.comments for select
  using (true);

-- Authenticated users can create comments
create policy "comments_insert_authenticated"
  on public.comments for insert
  with check (auth.uid() = author_id);

-- Users can only update their own comments
create policy "comments_update_own"
  on public.comments for update
  using (auth.uid() = author_id);

-- Users can only delete their own comments
create policy "comments_delete_own"
  on public.comments for delete
  using (auth.uid() = author_id);

-- Create indexes for faster lookups
create index if not exists comments_post_id_idx on public.comments(post_id);
create index if not exists comments_author_id_idx on public.comments(author_id);
create index if not exists comments_created_at_idx on public.comments(created_at desc);
