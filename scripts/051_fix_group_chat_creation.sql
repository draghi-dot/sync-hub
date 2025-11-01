-- Fix Group Chat Creation RLS Policies
-- This script ensures users can create group chats and add members without errors

-- ============================================
-- STEP 1: Fix chats INSERT policy for group chat creation
-- ============================================

-- Drop conflicting policies first
DROP POLICY IF EXISTS chats_insert_admin ON public.chats;
DROP POLICY IF EXISTS chats_insert_users ON public.chats;
DROP POLICY IF EXISTS chats_insert_department ON public.chats;
DROP POLICY IF EXISTS chats_insert_authenticated ON public.chats;
DROP POLICY IF EXISTS chats_insert_simple ON public.chats;

-- Create a comprehensive INSERT policy that allows group chat creation
CREATE POLICY chats_insert_authenticated ON public.chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can create any chat
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
    -- Users can create DMs and group chats (must be the creator)
    OR (
      type IN ('dm', 'group') 
      AND created_by = auth.uid()
    )
    -- Department members can create department chats for their department
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
-- STEP 2: Fix chat_members INSERT policy to allow group chat member addition
-- ============================================

-- First, drop ALL existing policies on chat_members to ensure clean slate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'chat_members'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_members', r.policyname);
    END LOOP;
END $$;

-- Drop specific policies as well (double safety)
DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert_simple ON public.chat_members;
DROP POLICY IF EXISTS chat_members_delete ON public.chat_members;
DROP POLICY IF EXISTS chat_members_delete_simple ON public.chat_members;

-- Create policy that allows:
-- 1. Users to add themselves to chats
-- 2. Chat creators to add any users to their chats (for group creation)
-- 3. Users being added to chats they're allowed to join
-- IMPORTANT: In WITH CHECK clause, reference columns directly (not with table alias)
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Case 1: User is adding themselves
    user_id = auth.uid()
    -- Case 2: Chat creator can add any users to their chats (KEY FOR GROUP CHAT CREATION)
    -- Use chat_id directly (not chat_members.chat_id) because we're inserting a new row
    OR EXISTS (
      SELECT 1 
      FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
        AND c.type IN ('dm', 'group')
    )
    -- Case 3: For department chats, department members can add themselves
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.user_departments ud ON ud.department_id = c.department_id
      WHERE c.id = chat_id
        AND c.type = 'department'
        AND ud.user_id = auth.uid()
        AND user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Ensure SELECT policies allow seeing chats and members
-- ============================================

-- Fix chats SELECT policy
DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_member ON public.chats;

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- Chat members can see their chats
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    -- Creator can see their chats (even if not yet in chat_members)
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

-- Fix chat_members SELECT policy (NO RECURSION - SIMPLE CHECK ONLY)
DROP POLICY IF EXISTS chat_members_select_member ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select_own ON public.chat_members;

-- Create SIMPLE SELECT policy with NO recursion
-- Users can only see their own memberships (direct check, no subqueries to avoid recursion)
CREATE POLICY chat_members_select ON public.chat_members
  FOR SELECT
  USING (
    -- Direct check: users can see their own memberships (NO recursion, NO subqueries)
    user_id = auth.uid()
  );

-- ============================================
-- STEP 4: Add DELETE policy for chat_members
-- ============================================

CREATE POLICY chat_members_delete ON public.chat_members
  FOR DELETE
  USING (
    -- Users can remove themselves
    user_id = auth.uid()
    -- OR chat creator can remove members
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_members.chat_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 5: Temporarily disable/enable RLS to ensure clean state
-- ============================================

-- Temporarily disable RLS to clear any cached policy states
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with fresh policies
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Verification
-- ============================================

-- Check all policies are created correctly
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN tablename = 'chats' AND cmd = 'INSERT' THEN '✅ Chat creation policy'
    WHEN tablename = 'chat_members' AND cmd = 'INSERT' THEN '✅ Member addition policy'
    WHEN tablename = 'chats' AND cmd = 'SELECT' THEN '✅ Chat visibility policy'
    WHEN tablename = 'chat_members' AND cmd = 'SELECT' THEN '✅ Member visibility policy'
    WHEN tablename = 'chat_members' AND cmd = 'DELETE' THEN '✅ Member deletion policy'
    ELSE 'Other policy'
  END as policy_type
FROM pg_policies 
WHERE tablename IN ('chats', 'chat_members')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Test query: Verify policies exist
SELECT 
  'Policy Check:' as test_description,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE tablename = 'chats' 
        AND policyname = 'chats_insert_authenticated'
        AND cmd = 'INSERT'
    ) THEN '✅ Chat INSERT policy exists'
    ELSE '❌ Chat INSERT policy missing'
  END as chats_insert_result,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_policies 
      WHERE tablename = 'chat_members' 
        AND policyname = 'chat_members_insert_own'
        AND cmd = 'INSERT'
    ) THEN '✅ Chat members INSERT policy exists'
    ELSE '❌ Chat members INSERT policy missing'
  END as chat_members_insert_result;

-- Show the actual WITH CHECK clause to verify it's correct
SELECT 
  'INSERT Policy Details:' as info,
  policyname,
  substring(with_check::text, 1, 300) as with_check_clause
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT';

