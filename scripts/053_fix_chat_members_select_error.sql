-- Quick Fix: Fix chat_members SELECT policy to prevent recursion errors
-- This fixes the "Error loading chat memberships" error

-- Drop all existing SELECT policies on chat_members
DROP POLICY IF EXISTS chat_members_select_member ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select ON public.chat_members;
DROP POLICY IF EXISTS chat_members_select_own ON public.chat_members;

-- Create SIMPLE SELECT policy with NO recursion
-- This allows users to see their own chat memberships without any circular dependencies
CREATE POLICY chat_members_select ON public.chat_members
  FOR SELECT
  USING (
    -- Direct check: users can see their own memberships
    -- This is the ONLY check - no subqueries to avoid recursion
    user_id = auth.uid()
  );

-- Verify the policy was created
SELECT 
  'Policy Status:' as info,
  policyname,
  cmd,
  '✅ Simple SELECT policy created (no recursion)' as status
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'SELECT';

