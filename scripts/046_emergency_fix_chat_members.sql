-- EMERGENCY FIX: Completely remove RLS and recreate from scratch
-- Use this if 045 doesn't work

-- ============================================
-- STEP 1: DISABLE RLS completely
-- ============================================
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop EVERY policy using dynamic SQL
-- ============================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Get all policy names
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'chat_members'
    ) LOOP
        -- Drop each policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_members CASCADE', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- ============================================
-- STEP 3: RE-ENABLE RLS
-- ============================================
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create ONLY the SELECT policy (simple, no recursion)
-- ============================================
CREATE POLICY chat_members_select_simple ON public.chat_members
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- STEP 5: Create INSERT policy
-- ============================================
CREATE POLICY chat_members_insert_simple ON public.chat_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 6: Verification
-- ============================================
SELECT 
  'Final policies after fix:' as status,
  policyname,
  cmd,
  'Should work now!' as note
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public';

