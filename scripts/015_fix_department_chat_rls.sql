-- Comprehensive fix for department chat access
-- This script ensures all department members can see all messages in their department chats

-- First, drop ALL existing policies that might conflict
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;

-- Also update chats policy to ensure department members can access department chats
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_membership ON public.chats;

-- Create a simpler, more robust SELECT policy for messages
-- This allows ANY user whose profile.department matches the chat's department name
-- to see ALL messages in that department's chats
CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- Allow if user is a chat member
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
    -- Department chats: Allow if user's department name matches the chat's department name
    -- This is case-insensitive to handle any case mismatches
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.departments d ON d.id = c.department_id
      INNER JOIN public.profiles p ON LOWER(TRIM(p.department)) = LOWER(TRIM(d.name))
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND p.id = auth.uid()
        AND p.department IS NOT NULL
        AND p.department != ''
    )
  );

-- Create INSERT policy for messages
CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      -- Allow if user is a chat member
      EXISTS (
        SELECT 1
        FROM public.chat_members m
        WHERE m.chat_id = public.messages.chat_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = public.messages.chat_id
          AND c.created_by = auth.uid()
      )
      -- Department chats: Allow if user's department name matches
      OR EXISTS (
        SELECT 1
        FROM public.chats c
        INNER JOIN public.departments d ON d.id = c.department_id
        INNER JOIN public.profiles p ON LOWER(TRIM(p.department)) = LOWER(TRIM(d.name))
        WHERE c.id = public.messages.chat_id
          AND c.type = 'department'
          AND p.id = auth.uid()
          AND p.department IS NOT NULL
          AND p.department != ''
      )
    )
  );

-- Update chats SELECT policy to allow department members to see department chats
CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- Existing: Chat members can see their chats
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    OR public.chats.created_by = auth.uid()
    -- Department chats: Allow if user's department name matches (case-insensitive)
    OR (
      public.chats.type = 'department'
      AND public.chats.department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.departments d ON d.id = public.chats.department_id
        WHERE p.id = auth.uid()
          AND LOWER(TRIM(p.department)) = LOWER(TRIM(d.name))
          AND p.department IS NOT NULL
          AND p.department != ''
      )
    )
  );

-- Verification query: Check if two users can see the same messages
-- Replace USER_ID_1 and USER_ID_2 with actual user IDs to test
/*
SELECT 
  'User 1 Department' as check_type,
  p1.department as user_department,
  d.name as department_name,
  d.id as department_id,
  c.id as chat_id,
  c.name as chat_name,
  CASE 
    WHEN LOWER(TRIM(p1.department)) = LOWER(TRIM(d.name)) THEN 'MATCH - User 1 can access'
    ELSE 'NO MATCH'
  END as user1_access
FROM public.profiles p1
CROSS JOIN public.departments d
LEFT JOIN public.chats c ON c.department_id = d.id AND c.type = 'department' AND c.name = 'general'
WHERE p1.id = 'USER_ID_1'  -- Replace with actual user ID
  AND p1.department IS NOT NULL

UNION ALL

SELECT 
  'User 2 Department' as check_type,
  p2.department as user_department,
  d.name as department_name,
  d.id as department_id,
  c.id as chat_id,
  c.name as chat_name,
  CASE 
    WHEN LOWER(TRIM(p2.department)) = LOWER(TRIM(d.name)) THEN 'MATCH - User 2 can access'
    ELSE 'NO MATCH'
  END as user2_access
FROM public.profiles p2
CROSS JOIN public.departments d
LEFT JOIN public.chats c ON c.department_id = d.id AND c.type = 'department' AND c.name = 'general'
WHERE p2.id = 'USER_ID_2'  -- Replace with actual user ID
  AND p2.department IS NOT NULL;
*/

