-- 033_set_company_specific_access_codes.sql
-- Set company-specific access codes for departments
-- Format: [COMPANY]-[DEPT]-1000
-- Adobe: AD-*, Google: GO-*, Electronic Arts: EA-*

-- IMPORTANT: First, remove the UNIQUE constraint on access_code
-- Multiple departments with the same name need to share the same access code
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_access_code_key;
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_access_code_unique;

-- Adobe Company Departments (AD-*)
UPDATE public.departments
SET access_code = 'AD-DEV-1000'
WHERE name = 'Software Development'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Adobe'
  );

UPDATE public.departments
SET access_code = 'AD-MAR-1000'
WHERE name = 'Marketing'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Adobe'
  );

UPDATE public.departments
SET access_code = 'AD-SEC-1000'
WHERE name = 'CyberSecurity'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Adobe'
  );

UPDATE public.departments
SET access_code = 'AD-FIN-1000'
WHERE name = 'Finance'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Adobe'
  );

UPDATE public.departments
SET access_code = 'AD-DES-1000'
WHERE name = 'Design'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Adobe'
  );

-- Google Company Departments (GO-*)
UPDATE public.departments
SET access_code = 'GO-DEV-1000'
WHERE name = 'Software Development'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Google'
  );

UPDATE public.departments
SET access_code = 'GO-MAR-1000'
WHERE name = 'Marketing'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Google'
  );

UPDATE public.departments
SET access_code = 'GO-SEC-1000'
WHERE name = 'CyberSecurity'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Google'
  );

UPDATE public.departments
SET access_code = 'GO-FIN-1000'
WHERE name = 'Finance'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Google'
  );

UPDATE public.departments
SET access_code = 'GO-DES-1000'
WHERE name = 'Design'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Google'
  );

-- Electronic Arts Company Departments (EA-*)
UPDATE public.departments
SET access_code = 'EA-DEV-1000'
WHERE name = 'Software Development'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Electronic Arts'
  );

UPDATE public.departments
SET access_code = 'EA-MAR-1000'
WHERE name = 'Marketing'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Electronic Arts'
  );

UPDATE public.departments
SET access_code = 'EA-SEC-1000'
WHERE name = 'CyberSecurity'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Electronic Arts'
  );

UPDATE public.departments
SET access_code = 'EA-FIN-1000'
WHERE name = 'Finance'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Electronic Arts'
  );

UPDATE public.departments
SET access_code = 'EA-DES-1000'
WHERE name = 'Design'
  AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = departments.team_id 
    AND teams.company = 'Electronic Arts'
  );

-- Verify the updates
SELECT 
  t.company,
  d.name as department_name,
  d.access_code,
  COUNT(*) as count
FROM public.departments d
INNER JOIN public.teams t ON t.id = d.team_id
GROUP BY t.company, d.name, d.access_code
ORDER BY t.company, d.name;

