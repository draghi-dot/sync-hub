-- Fix duplicate department chats issue
-- This ensures only ONE "general" chat exists per department

-- Step 1: Add unique constraint to prevent duplicate chats per department
ALTER TABLE public.chats 
DROP CONSTRAINT IF EXISTS chats_department_type_name_unique;

ALTER TABLE public.chats
ADD CONSTRAINT chats_department_type_name_unique 
UNIQUE (department_id, type, name);

-- Step 2: Find and remove duplicate "general" chats, keeping only the oldest one
-- First, identify duplicates
DO $$
DECLARE
  dept_record RECORD;
  duplicate_record RECORD;
  keep_chat_id UUID;
BEGIN
  -- For each department, find duplicate general chats
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
    
    -- Move all messages from duplicate chats to the kept chat
    UPDATE public.messages
    SET chat_id = keep_chat_id
    WHERE chat_id IN (
      SELECT id
      FROM public.chats
      WHERE department_id = dept_record.department_id
        AND type = 'department'
        AND name = 'general'
        AND id != keep_chat_id
    );
    
    -- Delete duplicate chats (cascade will handle related records)
    DELETE FROM public.chats
    WHERE department_id = dept_record.department_id
      AND type = 'department'
      AND name = 'general'
      AND id != keep_chat_id;
      
    RAISE NOTICE 'Merged duplicate chats for department %, kept chat %', dept_record.department_id, keep_chat_id;
  END LOOP;
END $$;

-- Step 3: Create any missing "general" chats for departments that don't have one
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

