-- 028_update_rls_for_multiple_departments.sql
-- Update RLS policies to use user_departments table instead of profile.department

-- Update chats policy to check user_departments
DROP POLICY IF EXISTS chats_select_membership ON public.chats;

CREATE POLICY chats_select_membership ON public.chats
  FOR SELECT
  USING (
    -- Existing: Chat members can see their chats
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.chats.id
        AND m.user_id = auth.uid()
    )
    OR public.chats.created_by = auth.uid()
    -- New: Department chats - allow if user is in user_departments for this department
    OR (
      public.chats.type = 'department'
      AND public.chats.department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_departments ud
        WHERE ud.user_id = auth.uid()
          AND ud.department_id = public.chats.department_id
      )
    )
  );

-- Update messages policy to check user_departments
DROP POLICY IF EXISTS messages_select_membership ON public.messages;

CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- Existing: Chat members can see messages
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    OR public.messages.sender_id = auth.uid()
    -- New: Department chat messages - allow if user is in user_departments
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.user_departments ud ON ud.department_id = c.department_id
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND ud.user_id = auth.uid()
    )
  );

-- Update messages insert policy to check user_departments
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;

CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    -- Existing: Chat members can send messages
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    OR public.messages.sender_id = auth.uid()
    -- New: Department chat messages - allow if user is in user_departments
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.user_departments ud ON ud.department_id = c.department_id
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND ud.user_id = auth.uid()
    )
  );

