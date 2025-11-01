-- 003_create_messages.sql (idempotent)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  is_ai_transcript BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow members of the chat or the creator to read messages
DROP POLICY IF EXISTS messages_select_membership ON public.messages;
CREATE POLICY messages_select_membership ON public.messages
  FOR SELECT
  USING (
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
  );

-- Allow sending messages if user is a member or the chat creator
DROP POLICY IF EXISTS messages_insert_membership ON public.messages;
CREATE POLICY messages_insert_membership ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.chat_members m
        WHERE m.chat_id = chat_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = chat_id
          AND c.created_by = auth.uid()
      )
    )
  );

-- Allow updating/deleting own messages; chat creator can also manage
DROP POLICY IF EXISTS messages_update_own_or_creator ON public.messages;
CREATE POLICY messages_update_own_or_creator ON public.messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = public.messages.chat_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_delete_own ON public.messages;
CREATE POLICY messages_delete_own ON public.messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);
