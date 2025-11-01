-- COMPLETE FIX: Fix both chats SELECT and chat_members INSERT policies
-- The INSERT policy needs to query chats, so chats SELECT must allow creators to see their chats

-- ============================================
-- STEP 1: Fix chats SELECT policy FIRST (required for INSERT policy)
-- ============================================

-- Drop all existing chats SELECT policies
DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_member ON public.chats;
DROP POLICY IF EXISTS chats_select_simple ON public.chats;

-- Create chats SELECT policy that:
-- 1. Allows creators to see chats they created (CRITICAL for INSERT policy)
-- 2. Allows members to see chats they're members of
-- 3. Allows department members to see department chats
CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- CRITICAL: Creator can see their chats (even if not yet in chat_members)
    -- This MUST be checked first for the INSERT policy to work!
    created_by = auth.uid()
    -- OR chat members can see their chats
    OR EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    -- OR department chats - allow if user is in user_departments
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
-- STEP 2: Fix chat_members SELECT policy (simple, no recursion)
-- ============================================

DROP POLICY IF EXISTS chat_members_select_member ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select_own ON public.chat_members;

CREATE POLICY chat_members_select ON public.chat_members
  FOR SELECT
  USING (
    -- Simple direct check - users can see their own memberships
    user_id = auth.uid()
  );

-- ============================================
-- STEP 3: Fix chat_members INSERT policy (can now query chats safely)
-- ============================================

-- Drop ALL existing INSERT policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'chat_members'
          AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_members', r.policyname);
        RAISE NOTICE 'Dropped INSERT policy: %', r.policyname;
    END LOOP;
END $$;

DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert_simple ON public.chat_members;

-- Temporarily disable/enable RLS to refresh
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy that allows:
-- 1. Users to add themselves
-- 2. Chat creators to add ANY users to chats they created
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Case 1: User is adding themselves
    user_id = auth.uid()
    -- Case 2: Chat creator can add ANY users to their chats
    -- This query will work because chats SELECT policy allows creators to see their chats
    OR EXISTS (
      SELECT 1 
      FROM public.chats
      WHERE id = chat_id
        AND created_by = auth.uid()
        AND type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 4: Ensure chats INSERT policy allows group creation
-- ============================================

DROP POLICY IF EXISTS chats_insert_admin ON public.chats;
DROP POLICY IF EXISTS chats_insert_users ON public.chats;
DROP POLICY IF EXISTS chats_insert_department ON public.chats;
DROP POLICY IF EXISTS chats_insert_authenticated ON public.chats;
DROP POLICY IF EXISTS chats_insert_simple ON public.chats;

CREATE POLICY chats_insert_authenticated ON public.chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can create any chat
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
    -- OR users can create DMs and group chats
    OR (
      type IN ('dm', 'group') 
      AND created_by = auth.uid()
    )
    -- OR department members can create department chats
    OR (
      type = 'department'
      AND department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_departments ud
        WHERE ud.user_id = auth.uid()
          AND ud.department_id = public.chats.department_id
      )
    )
  );

-- ============================================
-- STEP 5: Verification
-- ============================================

-- Verify chats SELECT policy
SELECT 
  '✅ Chats SELECT Policy' as status,
  policyname,
  CASE 
    WHEN qual::text LIKE '%created_by = auth.uid()%' THEN '✅ Allows creators to see chats'
    ELSE '⚠️ Check policy'
  END as creator_check
FROM pg_policies 
WHERE tablename = 'chats'
  AND schemaname = 'public'
  AND cmd = 'SELECT'
LIMIT 1;

-- Verify chat_members INSERT policy
SELECT 
  '✅ Chat Members INSERT Policy' as status,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT'
  AND policyname = 'chat_members_insert_own';

-- Test: Can you see chats you created?
SELECT 
  'Test: Can you see chats you created?' as test_name,
  COUNT(*) as count
FROM public.chats
WHERE created_by = auth.uid()
  AND type IN ('dm', 'group');

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '✅ Complete Fix Applied!' as status,
  'The policies should now allow:' as info1,
  '1. Creating group chats' as rule1,
  '2. Adding members to group chats you created' as rule2,
  '3. Seeing chats you created (required for #2)' as rule3,
  'Try creating a group chat now!' as next_step;

