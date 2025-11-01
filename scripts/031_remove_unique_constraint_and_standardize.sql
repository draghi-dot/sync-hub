-- 031_remove_unique_constraint_and_standardize.sql
-- First, remove the UNIQUE constraint on access_code since multiple departments can have the same code
-- Then standardize access codes so departments with the same name have the same code

-- Step 1: Remove UNIQUE constraint on access_code (multiple departments can share the same code)
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_access_code_key;

-- Step 2: Standardize access codes by department name
-- These codes will be used for ALL departments with the same name across ALL teams

UPDATE public.departments
SET access_code = 'DEV-2847'
WHERE name = 'Software Development';

UPDATE public.departments
SET access_code = 'MKT-6193'
WHERE name = 'Marketing';

UPDATE public.departments
SET access_code = 'SEC-9251'
WHERE name = 'CyberSecurity';

UPDATE public.departments
SET access_code = 'FIN-4738'
WHERE name = 'Finance';

UPDATE public.departments
SET access_code = 'DSG-8462'
WHERE name = 'Design';

-- Verify the updates
SELECT name, COUNT(*) as count, array_agg(DISTINCT access_code) as codes
FROM public.departments
GROUP BY name
ORDER BY name;

-- All departments with the same name should now show only ONE access code in the array

