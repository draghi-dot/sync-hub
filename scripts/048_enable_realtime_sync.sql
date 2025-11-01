-- Enable Realtime for messages table and related tables
-- This allows real-time subscriptions to work for INSERT, UPDATE, DELETE events

-- Step 1: Set REPLICA IDENTITY for tables (required for realtime)
-- This ensures PostgreSQL can track changes for replication
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chats REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chat_members REPLICA IDENTITY FULL;

-- Step 2: Add tables to realtime publication
DO $$
BEGIN
    -- Add messages table to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        RAISE NOTICE '✅ Added messages table to realtime publication';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'ℹ️ Messages table already in realtime publication';
        WHEN OTHERS THEN
            RAISE WARNING '❌ Error adding messages table: %', SQLERRM;
    END;

    -- Add chats table to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
        RAISE NOTICE '✅ Added chats table to realtime publication';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'ℹ️ Chats table already in realtime publication';
        WHEN OTHERS THEN
            RAISE WARNING '❌ Error adding chats table: %', SQLERRM;
    END;

    -- Add chat_members table to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
        RAISE NOTICE '✅ Added chat_members table to realtime publication';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'ℹ️ Chat_members table already in realtime publication';
        WHEN OTHERS THEN
            RAISE WARNING '❌ Error adding chat_members table: %', SQLERRM;
    END;
END $$;

-- Step 3: Verify the tables are added to the publication
SELECT 
    tablename,
    schemaname,
    CASE 
        WHEN tablename = 'messages' THEN '✅ CRITICAL - Messages realtime enabled'
        WHEN tablename IN ('chats', 'chat_members') THEN '✅ Optional - Realtime enabled'
        ELSE '⚠️ Unknown table'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND schemaname = 'public'
  AND tablename IN ('messages', 'chats', 'chat_members')
ORDER BY 
    CASE tablename
        WHEN 'messages' THEN 1
        WHEN 'chats' THEN 2
        WHEN 'chat_members' THEN 3
    END;

-- Step 4: Verify REPLICA IDENTITY is set correctly
SELECT 
    schemaname,
    tablename,
    CASE relreplident
        WHEN 'f' THEN 'FULL ✅'
        WHEN 'd' THEN 'DEFAULT'
        WHEN 'n' THEN 'NOTHING ❌'
        WHEN 'i' THEN 'INDEX'
        ELSE 'UNKNOWN'
    END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('messages', 'chats', 'chat_members')
  AND c.relkind = 'r'
ORDER BY c.relname;

