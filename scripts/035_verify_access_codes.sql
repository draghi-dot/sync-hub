-- 035_verify_access_codes.sql
-- Quick script to check current access codes in the database
-- This helps verify if the update script has been run

SELECT 
  t.company,
  d.name as department_name,
  d.access_code,
  COUNT(*) as count
FROM public.departments d
INNER JOIN public.teams t ON t.id = d.team_id
GROUP BY t.company, d.name, d.access_code
ORDER BY t.company, d.name, d.access_code;

-- Expected results after running 033_set_company_specific_access_codes.sql:
-- Adobe departments should all have AD-*-1000 codes
-- Google departments should all have GO-*-1000 codes  
-- Electronic Arts departments should all have EA-*-1000 codes

