-- Test script to verify group chat access and RLS policies
-- Run this to diagnose group chat issues

-- ============================================
-- STEP 1: Check if you have any group chats
-- ============================================
SELECT 
  c.id,
  c.name,
  c.type,
  c.created_by,
  COUNT(cm.user_id) as member_count
FROM public.chats c
LEFT JOIN public.chat_members cm ON cm.chat_id = c.id
WHERE c.type = 'group'
GROUP BY c.id, c.name, c.type, c.created_by;

-- ============================================
-- STEP 2: Check your membership in group chats
-- ============================================
SELECT 
  cm.chat_id,
  c.name as chat_name,
  c.type,
  cm.user_id,
  cm.joined_at
FROM public.chat_members cm
JOIN public.chats c ON c.id = cm.chat_id
WHERE cm.user_id = auth.uid()
  AND c.type = 'group'
ORDER BY cm.joined_at DESC;

-- ============================================
-- STEP 3: Test if you can SELECT chats (should show your group chats)
-- ============================================
SELECT 
  id,
  name,
  type,
  created_by
FROM public.chats
WHERE type = 'group'
  AND (
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- ============================================
-- STEP 4: Test if you can SELECT messages from a group chat
-- Replace 'YOUR_CHAT_ID' with an actual group chat ID
-- ============================================
-- Uncomment and replace YOUR_CHAT_ID:
-- SELECT 
--   m.id,
--   m.content,
--   m.sender_id,
--   m.created_at
-- FROM public.messages m
-- WHERE m.chat_id = 'YOUR_CHAT_ID'
-- ORDER BY m.created_at DESC
-- LIMIT 5;

-- ============================================
-- STEP 5: Test if you can INSERT a message (simulated)
-- This will show if the policy would allow an insert
-- ============================================
-- Uncomment and replace YOUR_CHAT_ID:
-- SELECT 
--   EXISTS (
--     SELECT 1
--     FROM public.chat_members m
--     WHERE m.chat_id = 'YOUR_CHAT_ID'
--       AND m.user_id = auth.uid()
--   ) as is_member,
--   EXISTS (
--     SELECT 1
--     FROM public.chats c
--     WHERE c.id = 'YOUR_CHAT_ID'
--       AND c.created_by = auth.uid()
--       AND c.type IN ('dm', 'group')
--   ) as is_creator;

-- ============================================
-- STEP 6: Check RLS policies are in place
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as has_with_check
FROM pg_policies 
WHERE tablename IN ('chats', 'messages', 'chat_members')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

