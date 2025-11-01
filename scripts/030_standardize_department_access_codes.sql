-- 030_standardize_department_access_codes.sql
-- Standardize access codes so departments with the same name have the same code across all teams
-- This ensures users can use the same code for "CyberSecurity" whether it's Photoshop, Illustrator, or InDesign

-- Update all departments to use standardized access codes by department name
-- Choose one code per department name that will be used across ALL teams

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

-- Note: If you want to add more departments later, make sure they follow the same pattern:
-- Same department name = same access code across all teams

