-- Update RLS policies to allow department members to access department chats
-- without requiring chat_members entry

-- Drop existing policies if they exist and create new ones that include department access
DROP POLICY IF EXISTS chats_select_members ON public.chats;
DROP POLICY IF EXISTS chats_select_membership ON public.chats;
DROP POLICY IF EXISTS chats_insert_admin ON public.chats;
DROP POLICY IF EXISTS chats_insert_users ON public.chats;
DROP POLICY IF EXISTS chats_insert_authenticated ON public.chats;

-- Create new policy that allows:
-- 1. Chat members (existing behavior)
-- 2. Department chats where user's profile.department matches the department
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
    -- New: Department chats - allow if user's department matches
    OR (
      public.chats.type = 'department'
      AND public.chats.department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.departments d ON d.name = p.department
        WHERE p.id = auth.uid()
          AND d.id = public.chats.department_id
      )
    )
  );

-- Update messages policy to allow department members to read messages from department chats
-- Drop ALL existing message select policies to avoid conflicts
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
DROP POLICY IF EXISTS messages_select_member ON public.messages;

CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
    -- Existing: Chat members can read messages
    EXISTS (
      SELECT 1
      FROM public.chat_members m
      WHERE m.chat_id = public.messages.chat_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
    -- New: Department chats - allow if user's department matches
    OR EXISTS (
      SELECT 1
      FROM public.chats c
      INNER JOIN public.departments d ON d.id = c.department_id
      INNER JOIN public.profiles p ON p.department = d.name
      WHERE c.id = public.messages.chat_id
        AND c.type = 'department'
        AND p.id = auth.uid()
        AND p.department IS NOT NULL
    )
  );

-- Update messages insert policy to allow department members to send messages
-- Drop ALL existing message insert policies to avoid conflicts
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
DROP POLICY IF EXISTS messages_insert_member ON public.messages;

CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      -- Existing: Chat members can send messages
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
      -- New: Department chats - allow if user's department matches
      OR EXISTS (
        SELECT 1
        FROM public.chats c
        INNER JOIN public.departments d ON d.id = c.department_id
        INNER JOIN public.profiles p ON p.department = d.name
        WHERE c.id = public.messages.chat_id
          AND c.type = 'department'
          AND p.id = auth.uid()
          AND p.department IS NOT NULL
      )
    )
  );

-- Update INSERT policy to allow department members to create department chats
CREATE POLICY chats_insert_department ON public.chats
  FOR INSERT
  WITH CHECK (
    -- Admins can create any chat
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
    -- Users can create DMs and group chats
    OR (type IN ('dm', 'group') AND created_by = auth.uid())
    -- Department members can create department chats for their department
    OR (
      type = 'department'
      AND department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.departments d ON d.id = department_id
        WHERE p.id = auth.uid()
          AND p.department = d.name
          AND p.department IS NOT NULL
      )
    )
  );
