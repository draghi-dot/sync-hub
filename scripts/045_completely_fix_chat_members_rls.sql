-- COMPLETE FIX: Remove ALL chat_members policies and recreate without recursion
-- This script drops every possible policy on chat_members and creates clean new ones

-- ============================================
-- STEP 1: Drop ALL existing chat_members policies (comprehensive cleanup)
-- ============================================

DROP POLICY IF EXISTS chat_members_select ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select_member ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;
DROP POLICY IF EXISTS chat_members_delete_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_update_creator ON public.chat_members;

-- Also drop any policies that might have been created by other scripts
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

-- ============================================
-- STEP 2: Create clean SELECT policy (NO RECURSION)
-- ============================================

CREATE POLICY chat_members_select ON public.chat_members
  FOR SELECT
  USING (
    -- Direct check: users can see their own memberships (NO recursion)
    user_id = auth.uid()
    -- OR chat creators can see members of their chats
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = chat_members.chat_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Create INSERT policy
-- ============================================

CREATE POLICY chat_members_insert ON public.chat_members
  FOR INSERT
  WITH CHECK (
    -- Users can add themselves
    user_id = auth.uid()
    -- OR chat creator can add members
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
        AND c.type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 4: Create DELETE policy
-- ============================================

CREATE POLICY chat_members_delete ON public.chat_members
  FOR DELETE
  USING (
    -- Users can remove themselves
    user_id = auth.uid()
    -- OR chat creator can remove members
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 5: DISABLE RLS TEMPORARILY to break recursion, then re-enable
-- ============================================

-- Temporarily disable RLS to break any recursion loops
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with clean policies
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Verification - Check all policies
-- ============================================

-- First, list what policies exist now
SELECT 
  'Current policies:' as info,
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
ORDER BY policyname;

-- Check for recursion indicators
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL AND qual::text LIKE '%FROM public.chat_members%' 
      OR qual IS NOT NULL AND qual::text LIKE '%FROM chat_members%'
    THEN '⚠️ RECURSION DETECTED in USING clause!'
    WHEN qual IS NOT NULL AND qual::text LIKE '%EXISTS%SELECT.*FROM.*chat_members%'
    THEN '⚠️ RECURSION DETECTED in EXISTS subquery!'
    ELSE '✓ No recursion in USING clause'
  END as recursion_check_using,
  CASE 
    WHEN with_check IS NOT NULL AND with_check::text LIKE '%FROM public.chat_members%'
      OR with_check IS NOT NULL AND with_check::text LIKE '%FROM chat_members%'
    THEN '⚠️ RECURSION DETECTED in WITH CHECK clause!'
    ELSE '✓ No recursion in WITH CHECK clause'
  END as recursion_check_with_check
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public';

-- Show the actual policy definitions
SELECT 
  'Policy Definitions:' as info,
  policyname,
  cmd,
  substring(qual::text, 1, 200) as using_clause_preview,
  substring(with_check::text, 1, 200) as with_check_clause_preview
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public';

