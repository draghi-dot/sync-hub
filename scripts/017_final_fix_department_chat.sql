-- FINAL FIX: Complete RLS policy update for department chats
-- Run this script to fix message visibility issues

-- ============================================
-- STEP 1: Drop ALL existing conflicting policies
-- ============================================

-- Drop message policies
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;

-- Drop chat policies  
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_select_member ON public.chats;

-- ============================================
-- STEP 2: Create new message SELECT policy
-- ============================================

CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- Allow if user is a chat member (existing functionality)
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    -- Allow if user created the chat
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
    -- Department chats: Allow ANY user whose department matches the chat's department
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

-- ============================================
-- STEP 3: Create new message INSERT policy
-- ============================================

CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    -- User must be the sender
    auth.uid() = sender_id
    AND (
      -- Allow if user is a chat member
      EXISTS (
        SELECT 1
        FROM public.chat_members m
        WHERE m.chat_id = public.messages.chat_id
          AND m.user_id = auth.uid()
      )
      -- Allow if user created the chat
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = public.messages.chat_id
          AND c.created_by = auth.uid()
      )
      -- Department chats: Allow if user's department matches
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

-- ============================================
-- STEP 4: Create new chat SELECT policy
-- ============================================

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- Allow if user is a chat member
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    -- Allow if user created the chat
    OR public.chats.created_by = auth.uid()
    -- Department chats: Allow if user's department matches
    OR (
      public.chats.type = 'department'
      AND public.chats.department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.departments d ON d.id = public.chats.department_id
        WHERE p.id = auth.uid()
          AND LOWER(TRIM(COALESCE(p.department, ''))) = LOWER(TRIM(COALESCE(d.name, '')))
          AND p.department IS NOT NULL
          AND p.department != ''
          AND d.name IS NOT NULL
      )
    )
  );

-- ============================================
-- STEP 5: Verification
-- ============================================

-- Check that policies were created
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('messages', 'chats')
  AND policyname LIKE '%membership%'
ORDER BY tablename, policyname;

-- Expected output should show:
-- messages | messages_select_membership | SELECT
-- messages | messages_insert_membership | INSERT
-- chats    | chats_select_membership   | SELECT

