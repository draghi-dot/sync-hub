-- Fix RLS policies to ensure group chat members can see and write messages
-- This script ensures all group chat members have proper access

-- ============================================
-- STEP 1: Fix chats SELECT policy to allow group chat members
-- ============================================

DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_member ON public.chats;

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- Chat members can see their chats (DMs and groups) - THIS IS THE KEY FOR GROUP CHATS
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    -- Creator can see their chats
    OR public.chats.created_by = auth.uid()
    -- Department chats - allow if user is in user_departments
    OR (
      public.chats.type = 'department'
      AND public.chats.department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_departments ud
        WHERE ud.user_id = auth.uid()
          AND ud.department_id = public.chats.department_id
      )
    )
  );

-- ============================================
-- STEP 2: Fix messages SELECT policy to allow group chat members
-- ============================================

DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;

CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- Chat members can see messages (works for DMs and groups) - THIS IS THE KEY FOR GROUP CHATS
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    -- Users can see their own messages (even if they somehow aren't in chat_members)
    OR public.messages.sender_id = auth.uid()
    -- Department chat messages - allow if user is in user_departments
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.user_departments ud ON ud.department_id = c.department_id
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND ud.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Fix messages INSERT policy to allow group chat members to write
-- ============================================

DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;

CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    -- User must be the sender
    auth.uid() = sender_id
    AND (
      -- Chat members can send messages (works for DMs and groups) - THIS IS THE KEY FOR GROUP CHATS
      EXISTS (
        SELECT 1
        FROM public.chat_members m
        WHERE m.chat_id = public.messages.chat_id
          AND m.user_id = auth.uid()
      )
      -- Creator can send messages even if not in chat_members (fallback)
      OR EXISTS (
        SELECT 1
        FROM public.chats c
        WHERE c.id = public.messages.chat_id
          AND c.created_by = auth.uid()
          AND c.type IN ('dm', 'group')
      )
      -- Department chat messages - allow if user is in user_departments
      OR EXISTS (
        SELECT 1
        FROM public.chats c
        INNER JOIN public.user_departments ud ON ud.department_id = c.department_id
        WHERE c.id = public.messages.chat_id
          AND c.type = 'department'
          AND ud.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- STEP 4: Fix chat_members SELECT policy to allow members to see membership
-- ============================================

DROP POLICY IF EXISTS chat_members_select_member ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select_own ON public.chat_members;

CREATE POLICY chat_members_select ON public.chat_members
  FOR SELECT
  USING (
    -- Users can see their own chat memberships (no recursion - direct check)
    user_id = auth.uid()
    -- OR they can see members of chats they created
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = chat_members.chat_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 5: Ensure chat_members INSERT policy allows group creators to add members
-- ============================================

DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;

CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  WITH CHECK (
    -- Users can add themselves
    user_id = auth.uid()
    -- OR chat creator can add members (for group chats and DMs)
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
        AND c.type IN ('dm', 'group')
    )
    -- Note: We removed the "existing members can add others" check to avoid infinite recursion
    -- If you need this feature, create a separate policy or use a different approach
  );

-- ============================================
-- Verification Query
-- ============================================

-- Check policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('chats', 'messages', 'chat_members')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
