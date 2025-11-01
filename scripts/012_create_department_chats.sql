-- Create default chats for each department
DO $$
DECLARE
  dept_record RECORD;
  chat_id UUID;
BEGIN
  FOR dept_record IN SELECT id FROM departments LOOP
    -- Create 'general' chat
    INSERT INTO chats (name, type, department_id, created_by)
    VALUES ('general', 'department', dept_record.id, NULL)
    ON CONFLICT DO NOTHING;

    -- Create 'daily-meeting' chat
    INSERT INTO chats (name, type, department_id, created_by)
    VALUES ('daily-meeting', 'department', dept_record.id, NULL)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
