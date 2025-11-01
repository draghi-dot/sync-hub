-- Verify and Fix chat_members INSERT Policy
-- This ensures the INSERT policy allows chat creators to add members

-- ============================================
-- STEP 1: Check current policies
-- ============================================

SELECT 
  'Current chat_members policies:' as info,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN '⚠️ Checking INSERT policy...'
    ELSE 'Other policy'
  END as status
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 2: Drop ALL existing INSERT policies (clean slate)
-- ============================================

-- Drop all possible INSERT policy names
DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert_simple ON public.chat_members;

-- Also drop any other INSERT policies dynamically
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

-- ============================================
-- STEP 3: Create a simple, working INSERT policy
-- ============================================

-- Create policy that allows:
-- 1. Users to add themselves
-- 2. Chat creators to add ANY users to their chats (for group creation)
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Case 1: User is adding themselves
    user_id = auth.uid()
    -- Case 2: Chat creator can add ANY users to their chats
    -- This is critical for group chat creation
    OR EXISTS (
      SELECT 1 
      FROM public.chats c
      WHERE c.id = chat_id  -- Use chat_id directly, not chat_members.chat_id
        AND c.created_by = auth.uid()
        AND c.type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 4: Verify the policy was created correctly
-- ============================================

SELECT 
  'Verification:' as info,
  policyname,
  cmd,
  '✅ INSERT policy created' as status
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT';

-- Show the WITH CHECK clause to verify it's correct
SELECT 
  'Policy Details:' as info,
  policyname,
  substring(with_check::text, 1, 400) as with_check_clause
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT';

-- ============================================
-- STEP 5: Test if the policy should work
-- ============================================

-- This query checks if a user can see chats they created
-- If this works, the INSERT policy should also work
SELECT 
  'Test: Can you see chats you created?' as test_name,
  COUNT(*) as chats_created_by_you
FROM public.chats
WHERE created_by = auth.uid()
  AND type IN ('dm', 'group');

-- ============================================
-- STEP 6: Temporarily refresh RLS
-- ============================================

-- Disable and re-enable RLS to ensure policy is active
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

SELECT '✅ RLS refreshed - INSERT policy should now be active' as status;

