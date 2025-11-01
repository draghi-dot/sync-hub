-- Verify that all users in the same department see the same chat
-- Run this to check for duplicate chats and see what chat IDs exist

-- Check for duplicate chats per department
SELECT 
  d.id as department_id,
  d.name as department_name,
  COUNT(c.id) as chat_count,
  STRING_AGG(c.id::text, ', ') as chat_ids,
  STRING_AGG(c.created_at::text, ', ') as created_dates
FROM public.departments d
LEFT JOIN public.chats c ON c.department_id = d.id 
  AND c.type = 'department' 
  AND c.name = 'general'
GROUP BY d.id, d.name
HAVING COUNT(c.id) > 1
ORDER BY d.name;

-- Show all department chats
SELECT 
  c.id as chat_id,
  c.name as chat_name,
  c.department_id,
  d.name as department_name,
  c.created_at,
  COUNT(m.id) as message_count
FROM public.chats c
INNER JOIN public.departments d ON d.id = c.department_id
LEFT JOIN public.messages m ON m.chat_id = c.id
WHERE c.type = 'department'
  AND c.name = 'general'
GROUP BY c.id, c.name, c.department_id, d.name, c.created_at
ORDER BY d.name, c.created_at;

-- Show messages and which chat they belong to
SELECT 
  m.id as message_id,
  m.content,
  m.chat_id,
  m.sender_id,
  sender_p.full_name as sender_name,
  sender_p.department as sender_department,
  c.department_id,
  d.name as department_name,
  c.created_at as chat_created_at
FROM public.messages m
INNER JOIN public.chats c ON c.id = m.chat_id
INNER JOIN public.profiles sender_p ON sender_p.id = m.sender_id
LEFT JOIN public.departments d ON d.id = c.department_id
WHERE c.type = 'department'
ORDER BY m.created_at DESC
LIMIT 20;

-- Check if users with same department see same chat
-- Replace 'DEPARTMENT_NAME' with actual department name
SELECT 
  p.id as user_id,
  p.full_name,
  p.department,
  c.id as chat_id,
  c.department_id,
  d.name as department_name_from_chat,
  CASE 
    WHEN LOWER(TRIM(p.department)) = LOWER(TRIM(d.name)) THEN 'SAME DEPARTMENT - CAN ACCESS'
    ELSE 'DIFFERENT DEPARTMENT'
  END as access_status
FROM public.profiles p
CROSS JOIN public.chats c
LEFT JOIN public.departments d ON d.id = c.department_id
WHERE c.type = 'department'
  AND c.name = 'general'
  AND p.department IS NOT NULL
ORDER BY p.department, c.department_id;

