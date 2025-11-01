-- 026_add_chat_delete_policies.sql
-- Add RLS policies to allow users to delete chats they created or leave chats they're members of

-- Drop existing delete policies if they exist
DROP POLICY IF EXISTS chats_delete_creator ON public.chats;
DROP POLICY IF EXISTS chat_members_delete_own ON public.chat_members;

-- Policy 1: Allow users to delete chats they created (DMs and group chats only)
-- Department chats should not be deletable by users
CREATE POLICY chats_delete_creator ON public.chats
  FOR DELETE
  USING (
    created_by = auth.uid()
    AND type IN ('dm', 'group')
    AND department_id IS NULL
  );

-- Policy 2: Allow users to leave chats (delete themselves from chat_members)
-- This is already handled by the existing chat_members_delete_own policy,
-- but let's ensure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_members'
      AND policyname = 'chat_members_delete_own'
  ) THEN
    CREATE POLICY chat_members_delete_own ON public.chat_members
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Note: Department chats should not be deletable by regular users
-- Only admins or system processes should manage department chats

