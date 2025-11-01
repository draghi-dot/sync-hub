-- Diagnostic script to check why users can't see each other's messages
-- Run this to see what's happening with your department chats

-- 1. Check what RLS policies are currently active
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as policy_condition
FROM pg_policies 
WHERE tablename IN ('messages', 'chats')
ORDER BY tablename, policyname;

-- 2. Check if users have the same department assigned
-- Replace 'USER_ID_1' and 'USER_ID_2' with your actual user IDs
SELECT 
  p1.id as user1_id,
  p1.department as user1_department,
  p2.id as user2_id,
  p2.department as user2_department,
  CASE 
    WHEN LOWER(TRIM(p1.department)) = LOWER(TRIM(p2.department)) THEN 'SAME DEPARTMENT'
    ELSE 'DIFFERENT DEPARTMENTS'
  END as department_match
FROM public.profiles p1
CROSS JOIN public.profiles p2
WHERE p1.id = 'USER_ID_1'  -- REPLACE WITH ACTUAL USER ID
  AND p2.id = 'USER_ID_2'  -- REPLACE WITH ACTUAL USER ID
  AND p1.department IS NOT NULL
  AND p2.department IS NOT NULL;

-- 3. Check what chats exist for a department
-- Replace 'DEPARTMENT_ID' with the actual department ID from the URL
SELECT 
  c.id as chat_id,
  c.name as chat_name,
  c.type,
  c.department_id,
  d.name as department_name,
  COUNT(DISTINCT m.id) as message_count
FROM public.chats c
INNER JOIN public.departments d ON d.id = c.department_id
LEFT JOIN public.messages m ON m.chat_id = c.id
WHERE c.department_id = 'DEPARTMENT_ID'  -- REPLACE WITH ACTUAL DEPARTMENT ID
  AND c.type = 'department'
GROUP BY c.id, c.name, c.type, c.department_id, d.name;

-- 4. Check all messages in a specific chat and see who can access them
-- Replace 'CHAT_ID' with the actual chat ID
SELECT 
  m.id as message_id,
  m.content,
  m.sender_id,
  sender_p.full_name as sender_name,
  sender_p.department as sender_department,
  m.created_at
FROM public.messages m
INNER JOIN public.profiles sender_p ON sender_p.id = m.sender_id
WHERE m.chat_id = 'CHAT_ID'  -- REPLACE WITH ACTUAL CHAT ID
ORDER BY m.created_at DESC;

-- 5. Test RLS policy manually for a specific user
-- Replace 'USER_ID' and 'CHAT_ID' with actual values
-- This simulates what RLS checks when a user tries to read messages
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.departments d ON d.id = c.department_id
      INNER JOIN public.profiles p ON LOWER(TRIM(p.department)) = LOWER(TRIM(d.name))
      WHERE c.id = 'CHAT_ID'  -- REPLACE
        AND c.type = 'department'
        AND p.id = 'USER_ID'  -- REPLACE
        AND p.department IS NOT NULL
        AND p.department != ''
    ) THEN 'USER CAN ACCESS THIS CHAT'
    ELSE 'USER CANNOT ACCESS THIS CHAT'
  END as access_check;

