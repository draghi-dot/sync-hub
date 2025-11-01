-- Create function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_company text;
  user_full_name text;
begin
  -- Extract company and full_name from metadata
  user_company := coalesce(new.raw_user_meta_data ->> 'company', null);
  user_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', null);

  -- Debug: Log metadata (optional - remove in production)
  -- RAISE NOTICE 'Creating profile for user %, company: %, full_name: %', new.id, user_company, user_full_name;

  -- Insert or update profile with company and full_name
  insert into public.profiles (id, email, full_name, company)
  values (
    new.id,
    new.email,
    user_full_name,
    user_company
  )
  on conflict (id) do update
  set 
    -- Always update company and full_name from metadata if provided (prioritize new values)
    company = coalesce(user_company, profiles.company),
    full_name = coalesce(user_full_name, profiles.full_name),
    email = new.email,
    updated_at = now();

  return new;
end;
$$;

-- Create trigger to automatically create profile on user signup
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
