-- Verify group chat members and fix any missing entries
-- Run this to check if users are properly added to group chats

-- ============================================
-- STEP 1: Find group chats with potential member issues
-- ============================================

-- Show all group chats and their member counts
SELECT 
  c.id as chat_id,
  c.name as chat_name,
  c.type,
  c.created_by,
  COUNT(cm.user_id) as member_count,
  ARRAY_AGG(cm.user_id) as member_ids
FROM public.chats c
LEFT JOIN public.chat_members cm ON cm.chat_id = c.id
WHERE c.type = 'group'
GROUP BY c.id, c.name, c.type, c.created_by
ORDER BY c.created_at DESC;

-- ============================================
-- STEP 2: Check if creator is in chat_members
-- ============================================

-- Find group chats where creator is NOT in chat_members
SELECT 
  c.id as chat_id,
  c.name as chat_name,
  c.created_by,
  'Creator missing from chat_members' as issue
FROM public.chats c
WHERE c.type = 'group'
  AND c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.chat_id = c.id
      AND cm.user_id = c.created_by
  );

-- ============================================
-- STEP 3: Fix missing creators in chat_members
-- ============================================

-- Add creators to their own group chats if missing
INSERT INTO public.chat_members (chat_id, user_id)
SELECT c.id, c.created_by
FROM public.chats c
WHERE c.type = 'group'
  AND c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.chat_id = c.id
      AND cm.user_id = c.created_by
  )
ON CONFLICT (chat_id, user_id) DO NOTHING;

-- ============================================
-- STEP 4: Show RLS policy status
-- ============================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages'
  AND schemaname = 'public'
  AND policyname = 'messages_insert_membership';

