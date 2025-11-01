-- FINAL FIX: Ensure group chat member insertion works
-- This script verifies and fixes the INSERT policy for chat_members

-- ============================================
-- STEP 1: Drop ALL existing INSERT policies (clean slate)
-- ============================================

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

-- Also drop by name (double safety)
DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_members;
DROP POLICY IF EXISTS chat_members_insert_simple ON public.chat_members;

-- ============================================
-- STEP 2: Temporarily disable RLS to ensure clean state
-- ============================================

ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Re-enable RLS
-- ============================================

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create the INSERT policy
-- ============================================
-- This policy allows:
-- 1. Users to add themselves (user_id = auth.uid())
-- 2. Chat creators to add ANY users to chats they created

CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user is adding themselves
    user_id = auth.uid()
    -- OR if the user created the chat and it's a DM or group chat
    OR EXISTS (
      SELECT 1 
      FROM public.chats 
      WHERE id = chat_id
        AND created_by = auth.uid()
        AND type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 5: Verify the policy exists and show details
-- ============================================

SELECT 
  '✅ INSERT Policy Created' as status,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT'
  AND policyname = 'chat_members_insert_own';

-- Show the WITH CHECK clause
SELECT 
  'Policy WITH CHECK clause:' as info,
  substring(with_check::text, 1, 500) as policy_definition
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT'
  AND policyname = 'chat_members_insert_own';

-- ============================================
-- STEP 6: Verify chats table SELECT policy allows seeing created chats
-- ============================================
-- The INSERT policy needs to query the chats table, so the chats SELECT policy
-- must allow users to see chats they created

SELECT 
  'Chats SELECT policy check:' as info,
  policyname,
  CASE 
    WHEN qual::text LIKE '%created_by%' OR qual::text LIKE '%auth.uid()%' THEN '✅ Should allow seeing created chats'
    ELSE '⚠️ May not allow seeing created chats'
  END as status
FROM pg_policies 
WHERE tablename = 'chats'
  AND schemaname = 'public'
  AND cmd = 'SELECT'
LIMIT 1;

-- ============================================
-- STEP 7: Test query - verify you can see chats you created
-- ============================================

SELECT 
  'Test: Can you see chats you created?' as test_name,
  COUNT(*) as chats_you_created
FROM public.chats
WHERE created_by = auth.uid()
  AND type IN ('dm', 'group');

-- If the count above is > 0 or you see your chats, the INSERT policy should work!

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '✅ Fix Complete!' as status,
  'The INSERT policy should now allow:' as info1,
  '1. Users to add themselves to chats' as rule1,
  '2. Chat creators to add any members to their group chats' as rule2,
  'Try creating a group chat now!' as next_step;

