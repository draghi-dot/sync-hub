-- FORCE MERGE: This will definitely merge all duplicate chats
-- Run this script - it handles everything in one go

-- ============================================
-- STEP 1: Add unique constraint
-- ============================================
ALTER TABLE public.chats 
DROP CONSTRAINT IF EXISTS chats_department_type_name_unique;

ALTER TABLE public.chats
ADD CONSTRAINT chats_department_type_name_unique 
UNIQUE (department_id, type, name);

-- ============================================
-- STEP 2: Merge ALL duplicates aggressively
-- ============================================
DO $$
DECLARE
  dept_record RECORD;
  keep_chat_id UUID;
  dup_chat RECORD;
  moved_count INTEGER;
BEGIN
  -- Find all departments with duplicates
  FOR dept_record IN 
    SELECT DISTINCT department_id
    FROM public.chats
    WHERE type = 'department' 
      AND name = 'general'
    GROUP BY department_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Processing department %', dept_record.department_id;
    
    -- Get ALL chats for this department, ordered by created_at
    -- Keep the FIRST (oldest) one
    SELECT id INTO keep_chat_id
    FROM public.chats
    WHERE department_id = dept_record.department_id
      AND type = 'department'
      AND name = 'general'
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
    
    IF keep_chat_id IS NULL THEN
      RAISE NOTICE 'No chat found for department %', dept_record.department_id;
      CONTINUE;
    END IF;
    
    RAISE NOTICE 'KEEPING chat ID: %', keep_chat_id;
    
    -- Loop through all other chats for this department
    FOR dup_chat IN 
      SELECT id
      FROM public.chats
      WHERE department_id = dept_record.department_id
        AND type = 'department'
        AND name = 'general'
        AND id != keep_chat_id
    LOOP
      RAISE NOTICE 'Merging chat % into %', dup_chat.id, keep_chat_id;
      
      -- Move messages
      UPDATE public.messages
      SET chat_id = keep_chat_id
      WHERE chat_id = dup_chat.id;
      
      GET DIAGNOSTICS moved_count = ROW_COUNT;
      RAISE NOTICE 'Moved % messages from chat %', moved_count, dup_chat.id;
      
      -- Delete the duplicate chat
      DELETE FROM public.chats
      WHERE id = dup_chat.id;
      
      RAISE NOTICE 'Deleted duplicate chat %', dup_chat.id;
    END LOOP;
    
    RAISE NOTICE 'Completed merging for department %', dept_record.department_id;
  END LOOP;
END $$;

-- ============================================
-- STEP 3: Verify no duplicates remain
-- ============================================
SELECT 
  'VERIFICATION: Checking for remaining duplicates...' as status;

SELECT 
  department_id,
  d.name as department_name,
  COUNT(*) as chat_count,
  STRING_AGG(c.id::text, ', ') as chat_ids
FROM public.chats c
LEFT JOIN public.departments d ON d.id = c.department_id
WHERE c.type = 'department' AND c.name = 'general'
GROUP BY department_id, d.name
HAVING COUNT(*) > 1;

-- If the above query returns NO ROWS, you're good!
-- If it returns rows, those departments still have duplicates

-- ============================================
-- STEP 4: Update RLS to allow all department members to see chats
-- ============================================

-- Update chats SELECT policy to ensure department members can see ALL department chats
DROP POLICY IF EXISTS chats_select_membership ON public.chats;

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- Chat members can see their chats
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    -- Chat creator can see their chats
    OR public.chats.created_by = auth.uid()
    -- Department chats: ANY user whose department matches can see ALL department chats
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

-- Update messages SELECT policy
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;

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

-- Update messages INSERT policy
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;

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

-- ============================================
-- STEP 5: Final verification
-- ============================================
SELECT 
  'DONE! All duplicate chats should be merged.' as status,
  'Refresh your browser and check the console - you should see only ONE chat ID per department.' as next_step;

