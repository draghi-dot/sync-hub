-- URGENT: Merge duplicate department chats
-- Run this immediately to fix the duplicate chat issue

-- Step 1: Add unique constraint if it doesn't exist
ALTER TABLE public.chats 
DROP CONSTRAINT IF EXISTS chats_department_type_name_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chats_department_type_name_unique'
  ) THEN
    ALTER TABLE public.chats
    ADD CONSTRAINT chats_department_type_name_unique 
    UNIQUE (department_id, type, name);
  END IF;
END $$;

-- Step 2: Find and merge ALL duplicate chats
DO $$
DECLARE
  dept_record RECORD;
  keep_chat_id UUID;
  duplicate_chat_ids UUID[];
  message_count INTEGER;
BEGIN
  -- For each department with duplicate general chats
  FOR dept_record IN 
    SELECT department_id, COUNT(*) as count
    FROM public.chats
    WHERE type = 'department' AND name = 'general'
    GROUP BY department_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Found % duplicate chats for department %', dept_record.count, dept_record.department_id;
    
    -- Get the OLDEST chat (first created) to keep
    SELECT id INTO keep_chat_id
    FROM public.chats
    WHERE department_id = dept_record.department_id
      AND type = 'department'
      AND name = 'general'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RAISE NOTICE 'Keeping chat ID: % (oldest one)', keep_chat_id;
    
    -- Collect all duplicate chat IDs (excluding the one we're keeping)
    SELECT ARRAY_AGG(id) INTO duplicate_chat_ids
    FROM public.chats
    WHERE department_id = dept_record.department_id
      AND type = 'department'
      AND name = 'general'
      AND id != keep_chat_id;
    
    RAISE NOTICE 'Duplicate chat IDs to merge: %', duplicate_chat_ids;
    
    -- Move all messages from duplicate chats to the kept chat
    IF duplicate_chat_ids IS NOT NULL THEN
      -- Count messages before merge
      SELECT COUNT(*) INTO message_count
      FROM public.messages
      WHERE chat_id = ANY(duplicate_chat_ids);
      
      RAISE NOTICE 'Moving % messages from duplicate chats to chat %', message_count, keep_chat_id;
      
      -- Move messages
      UPDATE public.messages
      SET chat_id = keep_chat_id
      WHERE chat_id = ANY(duplicate_chat_ids);
      
      RAISE NOTICE 'Moved messages successfully';
      
      -- Delete duplicate chats
      DELETE FROM public.chats
      WHERE id = ANY(duplicate_chat_ids);
      
      RAISE NOTICE 'Deleted % duplicate chats', array_length(duplicate_chat_ids, 1);
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Merge complete!';
END $$;

-- Step 3: Verify no duplicates remain
SELECT 
  department_id,
  COUNT(*) as chat_count,
  STRING_AGG(id::text, ', ') as chat_ids
FROM public.chats
WHERE type = 'department' AND name = 'general'
GROUP BY department_id
HAVING COUNT(*) > 1;

-- If the above query returns no rows, you're good!
-- If it returns rows, there are still duplicates and you may need to run this script again

