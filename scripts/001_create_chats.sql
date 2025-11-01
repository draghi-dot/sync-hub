-- Create chats table for department chats, DMs, and group chats
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('dm', 'group', 'department')),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Policies: Users can see chats they are members of
CREATE POLICY chats_select_members ON public.chats
  FOR SELECT
  USING (
    id IN (
      SELECT chat_id FROM public.chat_members WHERE user_id = auth.uid()
    )
  );

-- Admins can create chats
CREATE POLICY chats_insert_admin ON public.chats
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Users can create DMs and group chats
CREATE POLICY chats_insert_users ON public.chats
  FOR INSERT
  WITH CHECK (
    type IN ('dm', 'group') AND created_by = auth.uid()
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS chats_department_id_idx ON public.chats(department_id);
CREATE INDEX IF NOT EXISTS chats_type_idx ON public.chats(type);
