-- VERIFY AND FIX RLS POLICIES FOR MESSAGES
-- Run this to check what policies exist and fix them

-- Step 1: See what policies currently exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'messages'
ORDER BY policyname;

-- Step 2: Drop ALL existing message policies
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;

-- Step 3: Create SIMPLE, WORKING policy that allows department members
-- This policy allows ANY user in the same department to see ALL messages
CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- If user is a chat member, allow
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    -- If user created the chat, allow
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
    -- If chat is a department chat AND user's profile.department matches department.name
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.departments d ON d.id = c.department_id
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND LOWER(TRIM(COALESCE(p.department, ''))) = LOWER(TRIM(COALESCE(d.name, '')))
        AND p.department IS NOT NULL
        AND p.department != ''
        AND d.name IS NOT NULL
    )
  );

-- Step 4: Create INSERT policy
CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    -- User must be the sender
    auth.uid() = sender_id
    AND (
      -- If user is a chat member, allow
      EXISTS (
        SELECT 1
        FROM public.chat_members m
        WHERE m.chat_id = public.messages.chat_id
          AND m.user_id = auth.uid()
      )
      -- If user created the chat, allow
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = public.messages.chat_id
          AND c.created_by = auth.uid()
      )
      -- If chat is a department chat AND user's department matches
      OR EXISTS (
        SELECT 1
        FROM public.chats c
        INNER JOIN public.departments d ON d.id = c.department_id
        INNER JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = public.messages.chat_id
          AND c.type = 'department'
          AND LOWER(TRIM(COALESCE(p.department, ''))) = LOWER(TRIM(COALESCE(d.name, '')))
          AND p.department IS NOT NULL
          AND p.department != ''
          AND d.name IS NOT NULL
      )
    )
  );

-- Step 5: Test query (replace with actual values)
-- This shows what a user can see:
/*
SELECT 
  m.id,
  m.content,
  m.sender_id,
  p.department as user_department,
  d.name as department_name,
  c.type as chat_type
FROM public.messages m
INNER JOIN public.chats c ON c.id = m.chat_id
INNER JOIN public.departments d ON d.id = c.department_id
CROSS JOIN public.profiles p
WHERE p.id = auth.uid()
  AND c.id = 'CHAT_ID_HERE'
  AND c.type = 'department';
*/

