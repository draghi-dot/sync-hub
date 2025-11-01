-- Fix RLS policies for group chat creation
-- This ensures users can create group chats without conflicts

-- Drop any conflicting INSERT policies
DROP POLICY IF EXISTS chats_insert_admin ON public.chats;
DROP POLICY IF EXISTS chats_insert_users ON public.chats;
DROP POLICY IF EXISTS chats_insert_department ON public.chats;
DROP POLICY IF EXISTS chats_insert_authenticated ON public.chats;

-- Create a single, comprehensive INSERT policy
CREATE POLICY chats_insert_authenticated ON public.chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can create any chat
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
    -- Users can create DMs and group chats
    OR (type IN ('dm', 'group') AND created_by = auth.uid())
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

-- Verify the policy
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check 
FROM pg_policies 
WHERE tablename = 'chats' 
  AND schemaname = 'public'
ORDER BY policyname;

