-- Debug script to check department access setup
-- Run this to verify both users can access department chats

-- Check if RLS policies exist for department access
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('chats', 'messages')
  AND policyname LIKE '%membership%' OR policyname LIKE '%department%'
ORDER BY tablename, policyname;

-- Verify department chat access for a specific user (replace with actual user_id)
-- This shows if a user's profile department matches any department
SELECT 
  p.id as user_id,
  p.department as user_department,
  d.id as department_id,
  d.name as department_name,
  c.id as chat_id,
  c.name as chat_name,
  CASE 
    WHEN p.department = d.name THEN 'MATCH'
    ELSE 'NO MATCH'
  END as department_match
FROM public.profiles p
CROSS JOIN public.departments d
LEFT JOIN public.chats c ON c.department_id = d.id AND c.type = 'department'
WHERE p.id = auth.uid()  -- Replace with actual UUID if testing as admin
  AND p.department IS NOT NULL;

-- Check messages in department chats
SELECT 
  m.id as message_id,
  m.content,
  m.sender_id,
  sender_p.full_name as sender_name,
  sender_p.department as sender_department,
  c.id as chat_id,
  c.name as chat_name,
  c.type as chat_type,
  d.name as department_name
FROM public.messages m
INNER JOIN public.chats c ON c.id = m.chat_id
INNER JOIN public.departments d ON d.id = c.department_id
INNER JOIN public.profiles sender_p ON sender_p.id = m.sender_id
WHERE c.type = 'department'
ORDER BY m.created_at DESC
LIMIT 10;

