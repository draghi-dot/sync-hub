-- Create profiles table for user information
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  bio text,
  department text,
  job_title text,
  company text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- RLS Policies for profiles
-- Everyone can view all profiles (it's an internal company platform)
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- Users can only insert their own profile
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can only update their own profile
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Users can only delete their own profile
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- Create index for faster lookups
create index if not exists profiles_email_idx on public.profiles(email);
