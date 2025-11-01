-- ULTIMATE FIX: Use SECURITY DEFINER function to bypass RLS for member insertion
-- This is the most reliable solution for group chat member addition

-- ============================================
-- STEP 1: Create a SECURITY DEFINER function to add chat members
-- ============================================

-- Drop function if it exists
DROP FUNCTION IF EXISTS public.add_chat_members(UUID, UUID[]);

-- Create function that allows chat creators to add members
-- SECURITY DEFINER runs with the privileges of the function creator (postgres),
-- bypassing RLS policies for the inserts
CREATE OR REPLACE FUNCTION public.add_chat_members(
  p_chat_id UUID,
  p_user_ids UUID[]
)
RETURNS TABLE(
  id UUID,
  chat_id UUID,
  user_id UUID,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by UUID;
  v_chat_type TEXT;
  v_user_id UUID;
  v_result RECORD;
BEGIN
  -- Verify the current user created this chat
  SELECT created_by, type INTO v_created_by, v_chat_type
  FROM public.chats
  WHERE id = p_chat_id;
  
  -- Check if chat exists and user is the creator
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'Chat not found';
  END IF;
  
  IF v_created_by != auth.uid() THEN
    RAISE EXCEPTION 'Only the chat creator can add members';
  END IF;
  
  IF v_chat_type NOT IN ('dm', 'group') THEN
    RAISE EXCEPTION 'Can only add members to DM or group chats';
  END IF;
  
  -- Insert members
  FOR v_user_id IN SELECT unnest(p_user_ids)
  LOOP
    INSERT INTO public.chat_members (chat_id, user_id, joined_at)
    VALUES (p_chat_id, v_user_id, NOW())
    ON CONFLICT (chat_id, user_id) DO NOTHING
    RETURNING * INTO v_result;
    
    -- Return the inserted row
    IF v_result.id IS NOT NULL THEN
      id := v_result.id;
      chat_id := v_result.chat_id;
      user_id := v_result.user_id;
      joined_at := v_result.joined_at;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.add_chat_members(UUID, UUID[]) TO authenticated;

-- ============================================
-- STEP 2: Still fix the INSERT policy as backup
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
    END LOOP;
END $$;

-- Refresh RLS
ALTER TABLE public.chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- Create the INSERT policy (as backup, function is primary method)
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add themselves
    user_id = auth.uid()
    -- OR chat creator can add members (via direct query)
    OR EXISTS (
      SELECT 1 
      FROM public.chats
      WHERE id = chat_id
        AND created_by = auth.uid()
        AND type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 3: Ensure chats SELECT policy works
-- ============================================

DROP POLICY IF EXISTS chats_select_membership ON public.chats;

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- CRITICAL: Check creator first (before membership check)
    created_by = auth.uid()
    -- OR members can see their chats
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
-- STEP 4: Verification
-- ============================================

SELECT 
  '✅ Function Created' as status,
  proname as function_name,
  'Use: SELECT * FROM add_chat_members(chat_id, ARRAY[user_id1, user_id2])' as usage
FROM pg_proc
WHERE proname = 'add_chat_members'
  AND pronamespace = 'public'::regnamespace;

SELECT 
  '✅ INSERT Policy Created' as status,
  policyname
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT';

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '✅ Ultimate Fix Complete!' as status,
  'Two solutions available:' as info1,
  '1. Use function: add_chat_members(chat_id, ARRAY[user_ids])' as solution1,
  '2. Direct INSERT should also work now' as solution2,
  'The function bypasses RLS and is the most reliable method' as note;

