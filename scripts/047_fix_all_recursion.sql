-- COMPLETE FIX: Remove recursion from BOTH chats and chat_members policies
-- This fixes the circular dependency between chats and chat_members

-- ============================================
-- STEP 1: DISABLE RLS on both tables
-- ============================================
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop ALL policies on chat_members (dynamic)
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
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_members CASCADE', r.policyname);
        RAISE NOTICE 'Dropped chat_members policy: %', r.policyname;
    END LOOP;
END $$;

-- ============================================
-- STEP 3: Drop ALL policies on chats that reference chat_members
-- ============================================
DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_member ON public.chats;

-- Also drop any other chats policies dynamically
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'chats'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chats CASCADE', r.policyname);
        RAISE NOTICE 'Dropped chats policy: %', r.policyname;
    END LOOP;
END $$;

-- ============================================
-- STEP 4: RE-ENABLE RLS
-- ============================================
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Create SIMPLE chat_members SELECT policy (NO recursion)
-- ============================================
CREATE POLICY chat_members_select_simple ON public.chat_members
  FOR SELECT
  USING (
    -- Direct check: users can see their own memberships
    user_id = auth.uid()
  );

-- ============================================
-- STEP 6: Create SIMPLE chats SELECT policy (NO recursion, NO chat_members reference)
-- ============================================
CREATE POLICY chats_select_simple ON public.chats
  FOR SELECT
  USING (
    -- Creator can see their chats
    created_by = auth.uid()
    -- OR for department chats, use user_departments (doesn't query chat_members)
    OR (
      type = 'department'
      AND department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_departments ud
        WHERE ud.user_id = auth.uid()
          AND ud.department_id = chats.department_id
      )
    )
  );

-- But wait, this won't show group chats! We need a different approach.
-- Let's allow users to see chats where they're members, but query chat_members AFTER the policy check
-- Actually, the best approach is to use a SECURITY DEFINER function or allow both policies
-- For now, let's add a policy that allows seeing chats if user is a creator OR member

-- Drop and recreate with better approach
DROP POLICY IF EXISTS chats_select_simple ON public.chats;

-- The key insight: Since chat_members_select_simple only checks user_id = auth.uid(),
-- it's safe to query chat_members from the chats policy. There's no circular dependency.

CREATE POLICY chats_select_simple ON public.chats
  FOR SELECT
  USING (
    -- Creator can always see
    created_by = auth.uid()
    -- OR department chats via user_departments (no chat_members query here)
    OR (
      type = 'department'
      AND department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_departments ud
        WHERE ud.user_id = auth.uid()
          AND ud.department_id = chats.department_id
      )
    )
    -- OR if user is a member (safe to query chat_members because its policy is simple)
    OR EXISTS (
      SELECT 1
      FROM public.chat_members cm
      WHERE cm.chat_id = chats.id
        AND cm.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 7: Create INSERT policies
-- ============================================

-- chat_members INSERT
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

-- chats INSERT
CREATE POLICY chats_insert_simple ON public.chats
  FOR INSERT
  WITH CHECK (
    -- Users can create chats
    created_by = auth.uid()
    AND type IN ('dm', 'group', 'department')
  );

-- ============================================
-- STEP 8: Create DELETE policies
-- ============================================

CREATE POLICY chat_members_delete_simple ON public.chat_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 9: Verification
-- ============================================

SELECT 'chat_members policies:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'chat_members' AND schemaname = 'public';

SELECT 'chats policies:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'chats' AND schemaname = 'public';

-- Check for any recursion indicators
SELECT 
  'Recursion Check:' as info,
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%FROM public.chat_members%' OR qual::text LIKE '%FROM chat_members%'
    THEN '⚠️ REFERENCES chat_members'
    ELSE '✓ OK'
  END as check_result
FROM pg_policies 
WHERE tablename IN ('chats', 'chat_members')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

