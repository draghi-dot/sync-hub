-- 002_create_chat_members.sql (idempotent)
CREATE TABLE IF NOT EXISTS public.chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- Recreate policies idempotently (drop-then-create)
DROP POLICY IF EXISTS chat_members_select_own ON public.chat_members;
CREATE POLICY chat_members_select_own ON public.chat_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_members m2
      WHERE m2.chat_id = public.chat_members.chat_id
        AND m2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_members_insert_own ON public.chat_members;
CREATE POLICY chat_members_insert_own ON public.chat_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_members_delete_own ON public.chat_members;
CREATE POLICY chat_members_delete_own ON public.chat_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_members_update_creator ON public.chat_members;
CREATE POLICY chat_members_update_creator ON public.chat_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id
        AND c.created_by = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS chat_members_chat_id_idx ON public.chat_members(chat_id);
CREATE INDEX IF NOT EXISTS chat_members_user_id_idx ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS chat_members_chat_user_idx ON public.chat_members(chat_id, user_id);

-- Ensure chats SELECT policy exists but don't error if already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'chats_select_membership'
  ) THEN
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
      );
  END IF;
END $$;
