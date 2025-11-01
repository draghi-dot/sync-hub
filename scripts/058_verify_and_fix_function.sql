-- Verify the add_chat_members function exists and fix if needed

-- ============================================
-- STEP 1: Check if function exists
-- ============================================

SELECT 
  'Function Check:' as info,
  proname as function_name,
  CASE 
    WHEN proname = 'add_chat_members' THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status
FROM pg_proc
WHERE proname = 'add_chat_members'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================
-- STEP 2: Recreate function if needed (or update)
-- ============================================

-- Drop function if it exists
DROP FUNCTION IF EXISTS public.add_chat_members(UUID, UUID[]);

-- Create function with proper permissions
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
-- STEP 3: Also fix the INSERT policy as backup
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

-- Create simple INSERT policy
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add themselves
    user_id = auth.uid()
    -- OR chat creator can add members
    OR EXISTS (
      SELECT 1 
      FROM public.chats
      WHERE id = chat_id
        AND created_by = auth.uid()
        AND type IN ('dm', 'group')
    )
  );

-- ============================================
-- STEP 4: Verify everything
-- ============================================

-- Verify function
SELECT 
  '✅ Function Status' as status,
  proname,
  'Use: SELECT * FROM add_chat_members(chat_id, ARRAY[user_id1, user_id2])' as usage
FROM pg_proc
WHERE proname = 'add_chat_members';

-- Verify policy
SELECT 
  '✅ INSERT Policy Status' as status,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'chat_members'
  AND schemaname = 'public'
  AND cmd = 'INSERT';

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '✅ Fix Complete!' as status,
  'The function should now work via RPC call' as info1,
  'If RPC fails, direct INSERT should work as backup' as info2;

