-- 027_create_user_departments.sql
-- Create junction table for many-to-many relationship between users and departments
-- This allows users to be assigned to multiple departments

-- Create user_departments junction table
CREATE TABLE IF NOT EXISTS public.user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, department_id)
);

-- Enable RLS
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_departments_select_own ON public.user_departments;
DROP POLICY IF EXISTS user_departments_insert_own ON public.user_departments;
DROP POLICY IF EXISTS user_departments_delete_own ON public.user_departments;

-- Users can view their own department assignments
CREATE POLICY user_departments_select_own ON public.user_departments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add themselves to departments
CREATE POLICY user_departments_insert_own ON public.user_departments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove themselves from departments
CREATE POLICY user_departments_delete_own ON public.user_departments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_departments_user_id_idx ON public.user_departments(user_id);
CREATE INDEX IF NOT EXISTS user_departments_department_id_idx ON public.user_departments(department_id);

-- Migrate existing single department assignments to the new table
-- This preserves existing data
INSERT INTO public.user_departments (user_id, department_id)
SELECT 
  p.id as user_id,
  d.id as department_id
FROM public.profiles p
INNER JOIN public.departments d ON LOWER(TRIM(d.name)) = LOWER(TRIM(COALESCE(p.department, '')))
WHERE p.department IS NOT NULL 
  AND p.department != ''
ON CONFLICT (user_id, department_id) DO NOTHING;

-- Note: We ensure that departments with the same name have the same access_code
-- This is enforced by application logic, not by a database constraint
-- (Multiple teams can have the same department name with the same access code)

