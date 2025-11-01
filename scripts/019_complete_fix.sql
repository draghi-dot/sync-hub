-- COMPLETE FIX: Fix duplicate chats AND ensure RLS policies work
-- Run this script to fix everything at once

-- ============================================
-- PART 1: Fix duplicate chats
-- ============================================

-- Add unique constraint to prevent duplicate chats per department
ALTER TABLE public.chats 
DROP CONSTRAINT IF EXISTS chats_department_type_name_unique;

ALTER TABLE public.chats
ADD CONSTRAINT chats_department_type_name_unique 
UNIQUE (department_id, type, name);

-- Merge duplicate "general" chats and their messages
DO $$
DECLARE
  dept_record RECORD;
  keep_chat_id UUID;
  duplicate_chat_ids UUID[];
BEGIN
  -- For each department with duplicate general chats
  FOR dept_record IN 
    SELECT department_id, COUNT(*) as count
    FROM public.chats
    WHERE type = 'department' AND name = 'general'
    GROUP BY department_id
    HAVING COUNT(*) > 1
  LOOP
    -- Get the oldest chat (first created) to keep
    SELECT id INTO keep_chat_id
    FROM public.chats
    WHERE department_id = dept_record.department_id
      AND type = 'department'
      AND name = 'general'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Collect all duplicate chat IDs
    SELECT ARRAY_AGG(id) INTO duplicate_chat_ids
    FROM public.chats
    WHERE department_id = dept_record.department_id
      AND type = 'department'
      AND name = 'general'
      AND id != keep_chat_id;
    
    -- Move all messages from duplicate chats to the kept chat
    IF duplicate_chat_ids IS NOT NULL THEN
      UPDATE public.messages
      SET chat_id = keep_chat_id
      WHERE chat_id = ANY(duplicate_chat_ids);
      
      -- Delete duplicate chats
      DELETE FROM public.chats
      WHERE id = ANY(duplicate_chat_ids);
      
      RAISE NOTICE 'Merged % duplicate chats for department %, kept chat %, moved messages', 
        array_length(duplicate_chat_ids, 1), dept_record.department_id, keep_chat_id;
    END IF;
  END LOOP;
END $$;

-- Create any missing "general" chats
INSERT INTO public.chats (name, type, department_id, created_by)
SELECT 'general', 'department', d.id, NULL
FROM public.departments d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.chats c
  WHERE c.department_id = d.id
    AND c.type = 'department'
    AND c.name = 'general'
)
ON CONFLICT (department_id, type, name) DO NOTHING;

-- ============================================
-- PART 2: Fix RLS policies
-- ============================================

-- Drop ALL existing conflicting policies
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_select_member ON public.chats;

-- Create message SELECT policy (allows department members to see all messages)
CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- Chat members can read messages
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    -- Chat creator can read messages
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
    -- Department chats: ANY user whose department matches can see ALL messages
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.departments d ON d.id = c.department_id
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND LOWER(TRIM(COALESCE(p.department, ''))) = LOWER(TRIM(COALESCE(d.name, '')))
        AND p.department IS NOT NULL
        AND p.department != ''
        AND d.name IS NOT NULL
    )
  );

-- Create message INSERT policy (allows department members to send messages)
CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.chat_members m
        WHERE m.chat_id = public.messages.chat_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = public.messages.chat_id
          AND c.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.chats c
        INNER JOIN public.departments d ON d.id = c.department_id
        INNER JOIN public.profiles p ON p.id = auth.uid()
        WHERE c.id = public.messages.chat_id
          AND c.type = 'department'
          AND LOWER(TRIM(COALESCE(p.department, ''))) = LOWER(TRIM(COALESCE(d.name, '')))
          AND p.department IS NOT NULL
          AND p.department != ''
          AND d.name IS NOT NULL
      )
    )
  );

-- Create chat SELECT policy (allows department members to see department chats)
CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    OR public.chats.created_by = auth.uid()
    OR (
      public.chats.type = 'department'
      AND public.chats.department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.departments d ON d.id = public.chats.department_id
        WHERE p.id = auth.uid()
          AND LOWER(TRIM(COALESCE(p.department, ''))) = LOWER(TRIM(COALESCE(d.name, '')))
          AND p.department IS NOT NULL
          AND p.department != ''
          AND d.name IS NOT NULL
      )
    )
  );

-- ============================================
-- PART 3: Verification
-- ============================================

-- Check for any remaining duplicate chats
SELECT 
  department_id,
  COUNT(*) as chat_count
FROM public.chats
WHERE type = 'department' AND name = 'general'
GROUP BY department_id
HAVING COUNT(*) > 1;

-- Expected: No rows (no duplicates)

-- Verify policies were created
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('messages', 'chats')
  AND (policyname LIKE '%membership%' OR policyname LIKE '%member%')
ORDER BY tablename, policyname;

