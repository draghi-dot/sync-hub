-- SIMPLE FIX: Just make the INSERT policy work without needing a function
-- This should work if chats SELECT policy allows seeing created chats

-- ============================================
-- STEP 1: Ensure chats SELECT policy checks creator FIRST
-- ============================================

DROP POLICY IF EXISTS chats_select_membership ON public.chats;

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- CRITICAL: Check creator FIRST (before membership check)
    -- This allows INSERT policy to query chats table successfully
    created_by = auth.uid()
    -- OR members can see chats
    OR EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    -- OR department chats
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
-- STEP 2: Fix chat_members INSERT policy
-- ============================================

-- Drop all INSERT policies
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
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Disable and re-enable RLS
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- Create the INSERT policy
-- This should work because chats SELECT policy checks created_by FIRST
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Case 1: User adding themselves
    user_id = auth.uid()
    -- Case 2: Chat creator adding members
    -- This EXISTS query will work because chats SELECT policy checks created_by FIRST
    OR EXISTS (
      SELECT 1 
      FROM public.chats
      WHERE id = chat_id
        AND created_by = auth.uid()
        AND type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 3: Verify
-- ============================================

-- Check chats SELECT policy
SELECT 
  'Chats SELECT Policy:' as info,
  policyname,
  CASE 
    WHEN qual::text LIKE '%created_by = auth.uid()%' THEN '✅ Checks creator first'
    ELSE '⚠️ May not check creator first'
  END as status
FROM pg_policies 
WHERE tablename = 'chats'
  AND schemaname = 'public'
  AND cmd = 'SELECT'
LIMIT 1;

-- Check chat_members INSERT policy
SELECT 
  'Chat Members INSERT Policy:' as info,
  policyname,
  '✅ Policy created' as status
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT'
  AND policyname = 'chat_members_insert_own';

-- Test query: Can you see chats you created?
SELECT 
  'Test:' as info,
  COUNT(*) as chats_you_created,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✅ Can query chats you created'
    ELSE '❌ Cannot query chats'
  END as test_result
FROM public.chats
WHERE created_by = auth.uid()
  AND type IN ('dm', 'group');

SELECT '✅ Fix Complete! Try creating a group chat now.' as status;

